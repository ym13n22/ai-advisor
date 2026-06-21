import type { ConflictContext, ConflictResult } from "../types";
import { result } from "./helpers";

export function panicSellRule(ctx: ConflictContext): ConflictResult {
  const ratio = ctx.operation.fundRatio ?? 0;
  const active = ctx.recognition.intent === "卖出" && ctx.recognition.emotion === "恐慌" && ctx.profile.effectiveInvestmentMonths > 36;
  if (!active) return result("PANIC_SELL_OK", "恐慌卖出-长期目标冲突", "none", [], ["effectiveInvestmentMonths"], [], { ratio });
  const level = ratio >= 0.5 ? "high" : ratio >= 0.1 ? "medium" : "low";
  return result("PANIC_SELL_LONG_GOAL", "恐慌卖出-长期目标冲突", level, ["恐慌情绪下卖出可能偏离长期目标"], ["effectiveInvestmentMonths"], [], { ratio, emotion: ctx.recognition.emotion });
}

export function excitedBuyRule(ctx: ConflictContext): ConflictResult {
  const drawdown = ctx.product?.historicalMaxDrawdown;
  if (ctx.recognition.intent !== "买入" || ctx.recognition.emotion !== "兴奋" || drawdown == null) return result("EXCITED_BUY_OK", "兴奋买入-风险承受冲突", "none", [], ["effectiveMaxLossRatio"], ["historicalMaxDrawdown"], { drawdown });
  const diff = drawdown - ctx.profile.effectiveMaxLossRatio;
  if (diff <= 0) return result("EXCITED_BUY_WITHIN_TOLERANCE", "兴奋买入-风险承受冲突", "none", [], ["effectiveMaxLossRatio"], ["historicalMaxDrawdown"], { drawdown });
  const diffRatio = diff / Math.max(0.01, ctx.profile.effectiveMaxLossRatio);
  const level = diffRatio > 0.3 ? "high" : diffRatio >= 0.1 ? "medium" : "low";
  return result("EXCITED_BUY_OVER_TOLERANCE", "兴奋买入-风险承受冲突", level, ["兴奋情绪下买入的产品波动高于风险承受范围"], ["effectiveMaxLossRatio"], ["historicalMaxDrawdown"], { drawdown, tolerance: ctx.profile.effectiveMaxLossRatio, diffRatio });
}
