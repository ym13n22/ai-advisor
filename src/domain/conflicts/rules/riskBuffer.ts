import type { ConflictContext, ConflictResult } from "../types";
import { result } from "./helpers";

export function riskBufferRule(ctx: ConflictContext): ConflictResult {
  const drawdown = ctx.product?.historicalMaxDrawdown;
  if (drawdown == null) return result("RISK_BUFFER_MISSING", "风险缓冲弱-持仓风险冲突", "none", ["缺少产品回撤"], ["riskBufferAbility"], ["historicalMaxDrawdown"], {});
  if (ctx.profile.riskBufferAbility === "弱" && drawdown > 0.1) return result("RISK_BUFFER_WEAK_HIGH", "风险缓冲弱-持仓风险冲突", "high", ["风险缓冲能力弱且产品回撤较高"], ["riskBufferAbility"], ["historicalMaxDrawdown"], { buffer: ctx.profile.riskBufferAbility, drawdown });
  if (ctx.profile.riskBufferAbility === "弱" && drawdown > 0.05) return result("RISK_BUFFER_WEAK_MEDIUM", "风险缓冲弱-持仓风险冲突", "medium", ["风险缓冲能力弱且产品存在波动"], ["riskBufferAbility"], ["historicalMaxDrawdown"], { buffer: ctx.profile.riskBufferAbility, drawdown });
  if (ctx.profile.riskBufferAbility === "弱") return result("RISK_BUFFER_WEAK_LOW", "风险缓冲弱-持仓风险冲突", "low", ["风险缓冲能力弱，需关注资金安排"], ["riskBufferAbility"], ["historicalMaxDrawdown"], { buffer: ctx.profile.riskBufferAbility, drawdown });
  if (ctx.profile.riskBufferAbility === "中" && drawdown > 0.2) return result("RISK_BUFFER_MEDIUM_MEDIUM", "风险缓冲弱-持仓风险冲突", "medium", ["中等缓冲能力面对高波动产品需谨慎"], ["riskBufferAbility"], ["historicalMaxDrawdown"], { buffer: ctx.profile.riskBufferAbility, drawdown });
  return result("RISK_BUFFER_OK", "风险缓冲弱-持仓风险冲突", "none", [], ["riskBufferAbility"], ["historicalMaxDrawdown"], { buffer: ctx.profile.riskBufferAbility, drawdown });
}
