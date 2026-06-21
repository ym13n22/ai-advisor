import type { ConflictContext, ConflictResult } from "../types";
import { result } from "./helpers";

export function lossToleranceRule(ctx: ConflictContext): ConflictResult {
  const drawdown = ctx.product?.historicalMaxDrawdown;
  const tolerance = ctx.profile.effectiveMaxLossRatio;
  if (drawdown == null || tolerance == null || tolerance <= 0) return result("LOSS_TOLERANCE_MISSING", "损失承受-历史回撤冲突", "none", ["缺少产品回撤或用户损失承受数据"], ["effectiveMaxLossRatio"], ["historicalMaxDrawdown"], { drawdown, tolerance });
  const over = drawdown - tolerance;
  if (over <= 0) return result("LOSS_TOLERANCE_OK", "损失承受-历史回撤冲突", "none", [], ["effectiveMaxLossRatio"], ["historicalMaxDrawdown"], { drawdown, tolerance });
  const overRatio = over / tolerance;
  const level = overRatio > 0.5 ? "high" : overRatio > 0.2 ? "medium" : "low";
  return result("LOSS_TOLERANCE_OVER", "损失承受-历史回撤冲突", level, [`产品历史最大回撤 ${(drawdown * 100).toFixed(0)}% 高于可承受损失比例 ${(tolerance * 100).toFixed(0)}%`], ["effectiveMaxLossRatio"], ["historicalMaxDrawdown"], { drawdown, tolerance, overRatio });
}
