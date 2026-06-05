import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: './tests/setup/global.ts',
    setupFiles: ['./tests/setup/env.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false, // sequential — tests share one DB and one Redis DB
    reporters: ['verbose'],

    // ── Coverage ─────────────────────────────────────────────────────────────
    //
    // Provider: v8  — uses Node's built-in V8 coverage (no instrumentation
    // overhead, compatible with vitest v4).
    //
    // Reporters:
    //   text         — printed to stdout (visible in CI logs)
    //   json         — machine-readable, used by some badge services
    //   json-summary — required by davelosert/vitest-coverage-report-action
    //                  to post per-file coverage diffs on PRs
    //   html         — human-readable report, uploaded as a CI artifact
    //   lcov         — compatible with Codecov / SonarQube integrations
    //
    // Thresholds: conservative starting point reflecting current test suite
    // gaps (presence module untested, WebSocket events not covered).
    // Raise these incrementally as coverage improves.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      all: false, // only instrument files exercised by at least one test
      exclude: [
        // Infrastructure bootstrapping — not business logic
        'src/migrate.ts',
        'src/config/**',
        // Type-only files
        'src/**/*.d.ts',
        'src/shared/types/**',
        // Test setup
        'tests/**',
      ],
      thresholds: {
        // Fail CI if coverage drops below these values.
        // Current coverage gaps:
        //   – src/modules/presence/ (no integration tests yet)
        //   – POST /notifications/read (untested endpoint)
        //   – Socket.IO event emission (no socket client tests yet)
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
});
