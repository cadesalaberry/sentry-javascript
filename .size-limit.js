module.exports = [
  // Main browser webpack builds
  {
    name: '@sentry/browser (incl. Tracing, Replay, Feedback) - Webpack (gzipped)',
    path: 'packages/browser/build/npm/esm/index.js',
    import: '{ init, Replay, browserTracingIntegration, Feedback }',
    gzip: true,
    limit: '90 KB',
  },
  {
    name: '@sentry/browser (incl. Tracing, Replay) - Webpack (gzipped)',
    path: 'packages/browser/build/npm/esm/index.js',
    import: '{ init, Replay, browserTracingIntegration }',
    gzip: true,
    limit: '75 KB',
  },
  {
    name: '@sentry/browser (incl. Tracing, Replay with Canvas) - Webpack (gzipped)',
    path: 'packages/browser/build/npm/esm/index.js',
    import: '{ init, Replay, browserTracingIntegration, ReplayCanvas }',
    gzip: true,
    limit: '90 KB',
  },
  {
    name: '@sentry/browser (incl. Tracing, Replay) - Webpack with treeshaking flags (gzipped)',
    path: 'packages/browser/build/npm/esm/index.js',
    import: '{ init, Replay, browserTracingIntegration }',
    gzip: true,
    limit: '75 KB',
    modifyWebpackConfig: function (config) {
      const webpack = require('webpack');
      config.plugins.push(
        new webpack.DefinePlugin({
          __SENTRY_DEBUG__: false,
          __RRWEB_EXCLUDE_SHADOW_DOM__: true,
          __RRWEB_EXCLUDE_IFRAME__: true,
          __SENTRY_EXCLUDE_REPLAY_WORKER__: true,
        }),
      );
      return config;
    },
  },
  {
    name: '@sentry/browser (incl. Tracing) - Webpack (gzipped)',
    path: 'packages/browser/build/npm/esm/index.js',
    import: '{ init, browserTracingIntegration }',
    gzip: true,
    limit: '35 KB',
  },
  {
    name: '@sentry/browser (incl. browserTracingIntegration) - Webpack (gzipped)',
    path: 'packages/browser/build/npm/esm/index.js',
    import: '{ init, browserTracingIntegration }',
    gzip: true,
    limit: '35 KB',
  },
  {
    name: '@sentry/browser (incl. Feedback) - Webpack (gzipped)',
    path: 'packages/browser/build/npm/esm/index.js',
    import: '{ init, Feedback }',
    gzip: true,
    limit: '50 KB',
  },
  {
    name: '@sentry/browser (incl. sendFeedback) - Webpack (gzipped)',
    path: 'packages/browser/build/npm/esm/index.js',
    import: '{ init, sendFeedback }',
    gzip: true,
    limit: '50 KB',
  },
  {
    name: '@sentry/browser - Webpack (gzipped)',
    path: 'packages/browser/build/npm/esm/index.js',
    import: '{ init }',
    gzip: true,
    limit: '28 KB',
  },

  // Browser CDN bundles (ES6)
  {
    name: '@sentry/browser (incl. Tracing, Replay, Feedback) - ES6 CDN Bundle (gzipped)',
    path: 'packages/browser/build/bundles/bundle.tracing.replay.feedback.min.js',
    gzip: true,
    limit: '90 KB',
  },
  {
    name: '@sentry/browser (incl. Tracing, Replay) - ES6 CDN Bundle (gzipped)',
    path: 'packages/browser/build/bundles/bundle.tracing.replay.min.js',
    gzip: true,
    limit: '75 KB',
  },
  {
    name: '@sentry/browser (incl. Tracing) - ES6 CDN Bundle (gzipped)',
    path: 'packages/browser/build/bundles/bundle.tracing.min.js',
    gzip: true,
    limit: '37 KB',
  },
  {
    name: '@sentry/browser - ES6 CDN Bundle (gzipped)',
    path: 'packages/browser/build/bundles/bundle.min.js',
    gzip: true,
    limit: '28 KB',
  },

  // browser CDN bundles (ES6 + non-gzipped)
  {
    name: '@sentry/browser (incl. Tracing, Replay) - ES6 CDN Bundle (minified & uncompressed)',
    path: 'packages/browser/build/bundles/bundle.tracing.replay.min.js',
    gzip: false,
    brotli: false,
    limit: '260 KB',
  },
  {
    name: '@sentry/browser (incl. Tracing) - ES6 CDN Bundle (minified & uncompressed)',
    path: 'packages/browser/build/bundles/bundle.tracing.min.js',
    gzip: false,
    brotli: false,
    limit: '105 KB',
  },
  {
    name: '@sentry/browser - ES6 CDN Bundle (minified & uncompressed)',
    path: 'packages/browser/build/bundles/bundle.min.js',
    gzip: false,
    brotli: false,
    limit: '80 KB',
  },

  // Browser CDN bundles (ES5)
  // Replay is not supported in ES5 mode
  {
    name: '@sentry/browser (incl. Tracing) - ES5 CDN Bundle (gzipped)',
    path: 'packages/browser/build/bundles/bundle.tracing.es5.min.js',
    gzip: true,
    limit: '40 KB',
  },

  // React
  {
    name: '@sentry/react (incl. Tracing, Replay) - Webpack (gzipped)',
    path: 'packages/react/build/esm/index.mjs',
    import: '{ init, browserTracingIntegration, Replay }',
    gzip: true,
    limit: '75 KB',
  },
  {
    name: '@sentry/react - Webpack (gzipped)',
    path: 'packages/react/build/esm/index.mjs',
    import: '{ init }',
    gzip: true,
    limit: '30 KB',
  },

  // Next.js
  // We ignore next/router and next/constants because they break size-limit calculation
  // with new *.mjs bundles in v8
  {
    name: '@sentry/nextjs Client (incl. Tracing, Replay) - Webpack (gzipped)',
    path: 'packages/nextjs/build/esm/client/index.mjs',
    import: '{ init, browserTracingIntegration, Replay }',
    ignore: ['next/router', 'next/constants'],
    gzip: true,
    limit: '110 KB',
  },
  {
    name: '@sentry/nextjs Client - Webpack (gzipped)',
    path: 'packages/nextjs/build/esm/client/index.mjs',
    import: '{ init }',
    ignore: ['next/router', 'next/constants'],
    gzip: true,
    limit: '57 KB',
  },

  // Feedback
  {
    name: '@sentry-internal/feedback - Webpack (gzipped)',
    path: 'packages/feedback/build/npm/esm/index.mjs',
    import: '{ Feedback }',
    gzip: true,
    limit: '25 KB',
  },
];
