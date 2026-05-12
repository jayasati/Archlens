import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    server: {
      deps: {
        // jscpd imports `colors/safe` (CJS form); Vite's ESM loader is stricter
        // than Node's and only finds `colors/safe.js`. Inline jscpd so Vite
        // bundles it with the project's CJS interop, side-stepping the lookup.
        inline: [/jscpd/, /@jscpd\//],
      },
    },
  },
});
