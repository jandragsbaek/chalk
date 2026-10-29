import { definePlugin } from "@oxlint/plugins";

import namespaceNodeImports from "./rules/namespace-node-imports.ts";
import noDomTestEnvironment from "./rules/no-dom-test-environment.ts";
import noEmDashCopy from "./rules/no-em-dash-copy.ts";
import noHooklessUseFunction from "./rules/no-hookless-use-function.ts";
import noInlineSchemaCompile from "./rules/no-inline-schema-compile.ts";
import noLowValueComments from "./rules/no-low-value-comments.ts";
import noManualEffectRuntimeInTests from "./rules/no-manual-effect-runtime-in-tests.ts";
import noManualMemo from "./rules/no-manual-memo.ts";
import noPollingLoopInTests from "./rules/no-polling-loop-in-tests.ts";
import noRealTimeWaitInTests from "./rules/no-real-time-wait-in-tests.ts";
import noTestInLoop from "./rules/no-test-in-loop.ts";
import noTestTimeoutOrUnreasonedSkip from "./rules/no-test-timeout-or-unreasoned-skip.ts";
import noUnreasonedStateSync from "./rules/no-unreasoned-state-sync.ts";
import noUnscopedHas from "./rules/no-unscoped-has.ts";
import noWallClockInTests from "./rules/no-wall-clock-in-tests.ts";
import preferCatchTags from "./rules/prefer-catch-tags.ts";
import preferEffectFn from "./rules/prefer-effect-fn.ts";
import requireSuppressionReason from "./rules/require-suppression-reason.ts";

export default definePlugin({
  meta: {
    name: "chalk",
  },
  rules: {
    "namespace-node-imports": namespaceNodeImports,
    "no-dom-test-environment": noDomTestEnvironment,
    "no-em-dash-copy": noEmDashCopy,
    "no-hookless-use-function": noHooklessUseFunction,
    "no-inline-schema-compile": noInlineSchemaCompile,
    "no-low-value-comments": noLowValueComments,
    "no-manual-effect-runtime-in-tests": noManualEffectRuntimeInTests,
    "no-manual-memo": noManualMemo,
    "no-polling-loop-in-tests": noPollingLoopInTests,
    "no-real-time-wait-in-tests": noRealTimeWaitInTests,
    "no-test-in-loop": noTestInLoop,
    "no-test-timeout-or-unreasoned-skip": noTestTimeoutOrUnreasonedSkip,
    "no-unreasoned-state-sync": noUnreasonedStateSync,
    "no-unscoped-has": noUnscopedHas,
    "no-wall-clock-in-tests": noWallClockInTests,
    "prefer-catch-tags": preferCatchTags,
    "prefer-effect-fn": preferEffectFn,
    "require-suppression-reason": requireSuppressionReason,
  },
});
