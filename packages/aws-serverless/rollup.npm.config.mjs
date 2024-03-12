import { makeBaseNPMConfig, makeNPMConfigVariants } from '@sentry-internal/rollup-utils';

export default makeNPMConfigVariants(makeBaseNPMConfig({ hasBundles: true }), { hasEsm: false });
