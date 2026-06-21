import { excitedBuyRule, panicSellRule } from "./rules/behaviorProfile";
import { fundingGapRule } from "./rules/fundingGap";
import { goalRigidityRule } from "./rules/goalRigidity";
import { intermediateFundingRule } from "./rules/intermediateFunding";
import { liquidityRule } from "./rules/liquidity";
import { lossToleranceRule } from "./rules/lossTolerance";
import { riskBufferRule } from "./rules/riskBuffer";
import type { ConflictContext, ConflictResult } from "./types";
import { levelRank } from "./types";

const rules = [lossToleranceRule, liquidityRule, goalRigidityRule, intermediateFundingRule, riskBufferRule, fundingGapRule, panicSellRule, excitedBuyRule];

export function evaluateConflicts(ctx: ConflictContext) {
  const results = rules.map((rule) => rule(ctx)).filter((item) => item.conflictLevel !== "none");
  const overallConflictLevel = results.reduce<ConflictResult["conflictLevel"]>((max, item) => (levelRank[item.conflictLevel] > levelRank[max] ? item.conflictLevel : max), "none");
  return {
    overallConflictLevel,
    results,
    topConflict: results.sort((a, b) => levelRank[b.conflictLevel] - levelRank[a.conflictLevel])[0] ?? null,
    ruleVersion: "conflict-rules-v1.0"
  };
}
