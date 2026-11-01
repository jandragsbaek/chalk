import "vite-plus/test/config";
import { defineConfig } from "vite-plus";

const GENERATED_AND_BUILD_OUTPUT = [
  "dist",
  "node_modules",
  "pnpm-lock.yaml",
  "*.tsbuildinfo",
  "**/routeTree.gen.ts",
  "packages/contracts/openapi",
];

const TEST_FILES = [
  "**/*.{test,spec,testkit}.{ts,tsx}",
  "**/{test,tests,testkit,testing,fixtures,integration}/**",
];

/** React SPA: compiled by the React Compiler and held to the shadcn design-system rules. */
const REACT_APP_SOURCES = ["apps/web/src/**"];
/** Shared shadcn (Base UI) kit; it owns the class recipes the apps must not restyle. */
const UI_KIT_SOURCES = "packages/ui/src/**";
const REACT_SOURCES = [...REACT_APP_SOURCES, UI_KIT_SOURCES];
const tsx = (globs: ReadonlyArray<string>) => globs.map((glob) => `${glob}/*.{ts,tsx}`);

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**", "**/.{idea,git,cache,output,temp}/**"],
    hookTimeout: 60_000,
    testTimeout: 60_000,
    allowOnly: !process.env.CI,
    // Flaky tests are fixed, not retried.
    retry: 0,
    fakeTimers: {
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "setImmediate",
        "clearImmediate",
        "Date",
        "performance",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "requestIdleCallback",
        "cancelIdleCallback",
      ],
    },
  },
  staged: {
    // In order, so lint reads the formatted file.
    "*": ["vp fmt --no-error-on-unmatched-pattern", "vp lint --no-error-on-unmatched-pattern"],
  },
  fmt: {
    ignorePatterns: GENERATED_AND_BUILD_OUTPUT,
    sortPackageJson: {},
  },
  lint: {
    ignorePatterns: GENERATED_AND_BUILD_OUTPUT,
    plugins: ["eslint", "oxc", "react", "unicorn", "typescript"],
    jsPlugins: ["./oxlint-plugin-chalk/index.ts", "@shadcn/lint"],
    settings: {
      // Apps import the kit by package path.
      shadcn: { componentImports: ["^@chalk/ui/components/"] },
    },
    categories: {
      correctness: "warn",
      suspicious: "warn",
      perf: "warn",
    },
    rules: {
      "oxc/no-accumulating-spread": "error",
      "eslint/no-control-regex": "off",
      "typescript/no-this-alias": "off",
      "unicorn/prefer-add-event-listener": "off",
      "unicorn/prefer-string-starts-ends-with": "off",
      "unicorn/prefer-set-has": "off",
      "unicorn/prefer-array-find": "off",
      "unicorn/no-new-array": "off",
      "unicorn/no-array-reverse": "off",
      "react/no-object-type-as-default-prop": "off",
      "react/jsx-no-constructed-context-values": "off",
      "react/memo-dependencies": "error",
      "react/purity": "error",
      "react/refs": "error",
      "react/exhaustive-effect-dependencies": "error",
      "react/set-state-in-effect": "error",
      "react/immutability": "error",
      "react/no-array-index-key": "error",
      "react/no-unstable-nested-components": "error",
      "react/static-components": "error",
      "react/capitalized-calls": "error",
      "typescript/no-extraneous-class": "error",
      "eslint/no-empty-pattern": "error",
      "eslint/no-new": "error",
      "unicorn/no-useless-spread": "error",
      "eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "eslint/no-unsafe-optional-chaining": "error",
      "eslint/no-unneeded-ternary": "error",
      "unicorn/no-useless-fallback-in-spread": "error",
      "unicorn/require-module-specifiers": "error",
      "unicorn/no-array-sort": "off",
      "unicorn/consistent-function-scoping": "off",
      "oxc/no-map-spread": "off",
      "react-in-jsx-scope": "off",
      "react-hooks/exhaustive-deps": "off",
      "eslint/no-shadow": "off",
      "eslint/no-await-in-loop": "off",
      "eslint/no-underscore-dangle": "off",
      "chalk/no-inline-schema-compile": "error",
      "chalk/no-low-value-comments": "error",
      "chalk/no-manual-effect-runtime-in-tests": "error",
      // Test files only (the rule checks the filename).
      "chalk/no-polling-loop-in-tests": "error",
      "chalk/no-real-time-wait-in-tests": "error",
      "chalk/no-test-in-loop": "error",
      "chalk/no-test-timeout-or-unreasoned-skip": "error",
      "chalk/no-unscoped-has": "error",
      "chalk/no-wall-clock-in-tests": "error",
      "chalk/namespace-node-imports": "error",
      "chalk/prefer-catch-tags": "error",
      "chalk/prefer-effect-fn": "error",
      "chalk/require-suppression-reason": "error",
    },
    overrides: [
      {
        files: TEST_FILES,
        rules: { "chalk/prefer-effect-fn": "off" },
      },
      {
        files: ["apps/**/src/**", "packages/**/src/**"],
        rules: { "chalk/no-dom-test-environment": "error" },
      },
      {
        files: ["apps/*/src/**", "packages/*/src/**"],
        excludeFiles: ["**/*.{test,spec}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}", "**/testkit/**"],
        rules: { "chalk/no-em-dash-copy": "error" },
      },
      {
        files: REACT_APP_SOURCES,
        rules: {
          "eslint/no-restricted-imports": [
            "error",
            {
              patterns: [
                {
                  group: ["@chalk/ui/components/*"],
                  importNames: ["buttonVariants", "badgeVariants"],
                  message:
                    "Render the components/ui export instead of borrowing its class recipe (render={<Button …/>}).",
                },
              ],
            },
          ],
          "shadcn/require-static-classes": "error",
          "shadcn/no-arbitrary-values": ["error", { allow: ["layout", "transition"] }],
          "shadcn/no-restyle": ["error", { allow: ["layout"] }],
        },
      },
      {
        files: REACT_SOURCES,
        rules: {
          "shadcn/no-unknown-classes": "error",
          "shadcn/no-raw-colors": "error",
        },
      },
      {
        // React Compiler owns memoization; upstream rules do not ban redundant useMemo/useCallback.
        files: tsx(REACT_SOURCES),
        rules: {
          "react/exhaustive-effect-dependencies": "error",
          "react/globals": "error",
          "react/hooks": "error",
          "react/immutability": "error",
          // The compiler memoizes context values; this rule would ask for useMemo.
          "react/jsx-no-constructed-context-values": "off",
          "react/memo-dependencies": "error",
          "react/preserve-manual-memoization": "error",
          "react/purity": "error",
          "react/refs": "error",
          "react/set-state-in-effect": "error",
          "react/set-state-in-render": "error",
          "react/static-components": "error",
          "react/unsupported-syntax": "error",
          "chalk/no-manual-memo": "error",
        },
      },
      {
        files: [...REACT_APP_SOURCES, "packages/*/src/**"],
        rules: { "chalk/no-unreasoned-state-sync": "error" },
      },
      {
        // React Compiler caches use* functions only if they call a hook.
        files: tsx(REACT_SOURCES),
        excludeFiles: ["**/*.test.ts", "**/*.test.tsx"],
        rules: { "chalk/no-hookless-use-function": "error" },
      },
    ],
    options: {
      reportUnusedDisableDirectives: "error",
      typeAware: false,
      typeCheck: false,
    },
  },
});
