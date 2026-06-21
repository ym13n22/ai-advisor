import type { ConflictContext, ConflictResult } from "../types";
import { result } from "./helpers";

export function liquidityRule(ctx: ConflictContext): ConflictResult {
  if (!ctx.product) return result("LIQUIDITY_NO_PRODUCT", "期限-流动性冲突", "none", ["未选择产品"], ["earliestUseDate"], ["lockupDays"], {});
  const needDays = ctx.profile.effectiveInvestmentMonths * 30;
  const availableDays = ctx.product.hasLockup ? ctx.product.lockupDays + ctx.product.redeemArrivalDays : ctx.product.redeemArrivalDays;
  if (needDays <= 0) return result("LIQUIDITY_MISSING", "期限-流动性冲突", "none", ["缺少有效投资期限"], ["effectiveInvestmentMonths"], ["lockupDays", "redeemArrivalDays"], { needDays, availableDays });
  if (needDays >= availableDays) return result("LIQUIDITY_OK", "期限-流动性冲突", "none", [], ["effectiveInvestmentMonths"], ["lockupDays", "redeemArrivalDays"], { needDays, availableDays });
  const gapDays = availableDays - needDays;
  const level = gapDays > 90 ? "high" : gapDays > 30 ? "medium" : "low";
  return result("LIQUIDITY_LOCKUP_OVER_NEED", "期限-流动性冲突", level, ["资金可能早于产品可赎回时间被使用"], ["effectiveInvestmentMonths"], ["lockupDays", "redeemArrivalDays"], { needDays, availableDays, gapDays });
}
