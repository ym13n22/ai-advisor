import type { ConflictContext, ConflictResult } from "../types";
import { result } from "./helpers";

export function fundingGapRule(ctx: ConflictContext): ConflictResult {
  const drawdown = ctx.product?.historicalMaxDrawdown;
  const gap = ctx.profile.fundingGapRatio;
  if (drawdown == null) return result("FUNDING_GAP_MISSING", "资金缺口-风险承担冲突", "none", ["缺少产品回撤"], ["fundingGapRatio"], ["historicalMaxDrawdown"], {});
  if (gap > 0.5 && drawdown > 0.2) return result("FUNDING_GAP_HIGH", "资金缺口-风险承担冲突", "high", ["资金缺口较大且产品波动较高"], ["fundingGapRatio"], ["historicalMaxDrawdown"], { gap, drawdown });
  if (gap > 0.5 && drawdown > 0.1) return result("FUNDING_GAP_MEDIUM", "资金缺口-风险承担冲突", "medium", ["资金缺口较大且产品存在中等波动"], ["fundingGapRatio"], ["historicalMaxDrawdown"], { gap, drawdown });
  return result("FUNDING_GAP_OK", "资金缺口-风险承担冲突", "none", [], ["fundingGapRatio"], ["historicalMaxDrawdown"], { gap, drawdown });
}
