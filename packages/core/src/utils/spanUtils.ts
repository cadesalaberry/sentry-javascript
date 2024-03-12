import type {
  MeasurementUnit,
  Primitive,
  Scope,
  Span,
  SpanAttributes,
  SpanJSON,
  SpanOrigin,
  SpanStatus,
  SpanTimeInput,
  TraceContext,
} from '@sentry/types';
import {
  addNonEnumerableProperty,
  dropUndefinedKeys,
  generateSentryTraceHeader,
  timestampInSeconds,
} from '@sentry/utils';
import { getMainCarrier } from '../asyncContext';
import { getCurrentScope } from '../currentScopes';
import { getAsyncContextStrategy } from '../hub';
import { getMetricSummaryJsonForSpan, updateMetricSummaryOnSpan } from '../metrics/metric-summary';
import type { MetricType } from '../metrics/types';
import { SEMANTIC_ATTRIBUTE_SENTRY_OP, SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN } from '../semanticAttributes';
import type { SentrySpan } from '../tracing/sentrySpan';
import { SPAN_STATUS_OK, SPAN_STATUS_UNSET } from '../tracing/spanstatus';

// These are aligned with OpenTelemetry trace flags
export const TRACE_FLAG_NONE = 0x0;
export const TRACE_FLAG_SAMPLED = 0x1;

/**
 * Convert a span to a trace context, which can be sent as the `trace` context in an event.
 */
export function spanToTraceContext(span: Span): TraceContext {
  const { spanId: span_id, traceId: trace_id } = span.spanContext();
  const { data, op, parent_span_id, status, origin } = spanToJSON(span);

  return dropUndefinedKeys({
    data,
    op,
    parent_span_id,
    span_id,
    status,
    trace_id,
    origin,
  });
}

/**
 * Convert a Span to a Sentry trace header.
 */
export function spanToTraceHeader(span: Span): string {
  const { traceId, spanId } = span.spanContext();
  const sampled = spanIsSampled(span);
  return generateSentryTraceHeader(traceId, spanId, sampled);
}

/**
 * Convert a span time input intp a timestamp in seconds.
 */
export function spanTimeInputToSeconds(input: SpanTimeInput | undefined): number {
  if (typeof input === 'number') {
    return ensureTimestampInSeconds(input);
  }

  if (Array.isArray(input)) {
    // See {@link HrTime} for the array-based time format
    return input[0] + input[1] / 1e9;
  }

  if (input instanceof Date) {
    return ensureTimestampInSeconds(input.getTime());
  }

  return timestampInSeconds();
}

/**
 * Converts a timestamp to second, if it was in milliseconds, or keeps it as second.
 */
function ensureTimestampInSeconds(timestamp: number): number {
  const isMs = timestamp > 9999999999;
  return isMs ? timestamp / 1000 : timestamp;
}

/**
 * Convert a span to a JSON representation.
 * Note that all fields returned here are optional and need to be guarded against.
 *
 * Note: Because of this, we currently have a circular type dependency (which we opted out of in package.json).
 * This is not avoidable as we need `spanToJSON` in `spanUtils.ts`, which in turn is needed by `span.ts` for backwards compatibility.
 * And `spanToJSON` needs the Span class from `span.ts` to check here.
 */
export function spanToJSON(span: Span): Partial<SpanJSON> {
  if (spanIsSentrySpan(span)) {
    return span.getSpanJSON();
  }

  try {
    const { spanId: span_id, traceId: trace_id } = span.spanContext();

    // Handle a span from @opentelemetry/sdk-base-trace's `Span` class
    if (spanIsOpenTelemetrySdkTraceBaseSpan(span)) {
      const { attributes, startTime, name, endTime, parentSpanId, status } = span;

      return dropUndefinedKeys({
        span_id,
        trace_id,
        data: attributes,
        description: name,
        parent_span_id: parentSpanId,
        start_timestamp: spanTimeInputToSeconds(startTime),
        // This is [0,0] by default in OTEL, in which case we want to interpret this as no end time
        timestamp: spanTimeInputToSeconds(endTime) || undefined,
        status: getStatusMessage(status),
        op: attributes[SEMANTIC_ATTRIBUTE_SENTRY_OP],
        origin: attributes[SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN] as SpanOrigin | undefined,
        _metrics_summary: getMetricSummaryJsonForSpan(span),
      });
    }

    // Finally, at least we have `spanContext()`....
    return {
      span_id,
      trace_id,
    };
  } catch {
    return {};
  }
}

function spanIsOpenTelemetrySdkTraceBaseSpan(span: Span): span is OpenTelemetrySdkTraceBaseSpan {
  const castSpan = span as OpenTelemetrySdkTraceBaseSpan;
  return !!castSpan.attributes && !!castSpan.startTime && !!castSpan.name && !!castSpan.endTime && !!castSpan.status;
}

/** Exported only for tests. */
export interface OpenTelemetrySdkTraceBaseSpan extends Span {
  attributes: SpanAttributes;
  startTime: SpanTimeInput;
  name: string;
  status: SpanStatus;
  endTime: SpanTimeInput;
  parentSpanId?: string;
}

/**
 * Sadly, due to circular dependency checks we cannot actually import the Span class here and check for instanceof.
 * :( So instead we approximate this by checking if it has the `getSpanJSON` method.
 */
function spanIsSentrySpan(span: Span): span is SentrySpan {
  return typeof (span as SentrySpan).getSpanJSON === 'function';
}

/**
 * Returns true if a span is sampled.
 * In most cases, you should just use `span.isRecording()` instead.
 * However, this has a slightly different semantic, as it also returns false if the span is finished.
 * So in the case where this distinction is important, use this method.
 */
export function spanIsSampled(span: Span): boolean {
  // We align our trace flags with the ones OpenTelemetry use
  // So we also check for sampled the same way they do.
  const { traceFlags } = span.spanContext();
  // eslint-disable-next-line no-bitwise
  return Boolean(traceFlags & TRACE_FLAG_SAMPLED);
}

/** Get the status message to use for a JSON representation of a span. */
export function getStatusMessage(status: SpanStatus | undefined): string | undefined {
  if (!status || status.code === SPAN_STATUS_UNSET) {
    return undefined;
  }

  if (status.code === SPAN_STATUS_OK) {
    return 'ok';
  }

  return status.message || 'unknown_error';
}

const CHILD_SPANS_FIELD = '_sentryChildSpans';
const ROOT_SPAN_FIELD = '_sentryRootSpan';

type SpanWithPotentialChildren = Span & {
  [CHILD_SPANS_FIELD]?: Set<Span>;
  [ROOT_SPAN_FIELD]?: Span;
};

/**
 * Adds an opaque child span reference to a span.
 */
export function addChildSpanToSpan(span: SpanWithPotentialChildren, childSpan: Span): void {
  // We store the root span reference on the child span
  // We need this for `getRootSpan()` to work
  const rootSpan = span[ROOT_SPAN_FIELD] || span;
  addNonEnumerableProperty(childSpan as SpanWithPotentialChildren, ROOT_SPAN_FIELD, rootSpan);

  // We store a list of child spans on the parent span
  // We need this for `getSpanDescendants()` to work
  if (span[CHILD_SPANS_FIELD] && span[CHILD_SPANS_FIELD].size < 1000) {
    span[CHILD_SPANS_FIELD].add(childSpan);
  } else {
    addNonEnumerableProperty(span, CHILD_SPANS_FIELD, new Set([childSpan]));
  }
}

/** This is only used internally by Idle Spans. */
export function removeChildSpanFromSpan(span: SpanWithPotentialChildren, childSpan: Span): void {
  if (span[CHILD_SPANS_FIELD]) {
    span[CHILD_SPANS_FIELD].delete(childSpan);
  }
}

/**
 * Returns an array of the given span and all of its descendants.
 */
export function getSpanDescendants(span: SpanWithPotentialChildren): Span[] {
  const resultSet = new Set<Span>();

  function addSpanChildren(span: SpanWithPotentialChildren): void {
    // This exit condition is required to not infinitely loop in case of a circular dependency.
    if (resultSet.has(span)) {
      return;
      // We want to ignore unsampled spans (e.g. non recording spans)
    } else if (spanIsSampled(span)) {
      resultSet.add(span);
      const childSpans = span[CHILD_SPANS_FIELD] ? Array.from(span[CHILD_SPANS_FIELD]) : [];
      for (const childSpan of childSpans) {
        addSpanChildren(childSpan);
      }
    }
  }

  addSpanChildren(span);

  return Array.from(resultSet);
}

/**
 * Returns the root span of a given span.
 */
export function getRootSpan(span: SpanWithPotentialChildren): Span {
  return span[ROOT_SPAN_FIELD] || span;
}

const SCOPE_SPAN_FIELD = '_sentrySpan';

type ScopeWithMaybeSpan = Scope & {
  [SCOPE_SPAN_FIELD]?: Span;
};

/**
 * Set the active span for a given scope.
 * NOTE: This should NOT be used directly, but is only used internally by the trace methods.
 */
export function _setSpanForScope(scope: Scope, span: Span | undefined): void {
  if (span) {
    addNonEnumerableProperty(scope as ScopeWithMaybeSpan, SCOPE_SPAN_FIELD, span);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (scope as ScopeWithMaybeSpan)[SCOPE_SPAN_FIELD];
  }
}

/**
 * Get the active span for a given scope.
 * NOTE: This should NOT be used directly, but is only used internally by the trace methods.
 */
export function _getSpanForScope(scope: ScopeWithMaybeSpan): Span | undefined {
  return scope[SCOPE_SPAN_FIELD];
}

/**
 * Returns the currently active span.
 */
export function getActiveSpan(): Span | undefined {
  const carrier = getMainCarrier();
  const acs = getAsyncContextStrategy(carrier);
  if (acs.getActiveSpan) {
    return acs.getActiveSpan();
  }

  return _getSpanForScope(getCurrentScope());
}

/**
 * Updates the metric summary on the currently active span
 */
export function updateMetricSummaryOnActiveSpan(
  metricType: MetricType,
  sanitizedName: string,
  value: number,
  unit: MeasurementUnit,
  tags: Record<string, Primitive>,
  bucketKey: string,
): void {
  const span = getActiveSpan();
  if (span) {
    updateMetricSummaryOnSpan(span, metricType, sanitizedName, value, unit, tags, bucketKey);
  }
}
