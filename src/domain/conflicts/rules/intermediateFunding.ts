import type { ConflictContext, ConflictResult } from "../types";
import { result } from "./helpers";

export function intermediateFundingRule(ctx: ConflictContext): ConflictResult {
  const prob = ctx.profile.interimFundingProbability;
  const product = ctx.product;
  if (!product) return result("INTERIM_NO_PRODUCT", "中途用款-产品波动冲突", "none", ["未选择产品"], ["interimFundingProbability"], ["lockupDays"], {});
  if (prob > 70 && product.lockupDays > 30 && product.redeemArrivalDays > 7) return result("INTERIM_FUNDING_HIGH", "中途用款-产品波动冲突", "high", ["中途用款概率高且产品流动性较弱"], ["interimFundingProbability"], ["lockupDays", "redeemArrivalDays"], { prob, lockupDays: product.lockupDays, redeemArrivalDays: product.redeemArrivalDays });
  if (prob > 50 && product.lockupDays >= 30 && product.redeemArrivalDays >= 4) return result("INTERIM_FUNDING_MEDIUM", "中途用款-产品波动冲突", "medium", ["中途用款概率偏高且赎回到账较慢"], ["interimFundingProbability"], ["lockupDays", "redeemArrivalDays"], { prob, lockupDays: product.lockupDays, redeemArrivalDays: product.redeemArrivalDays });
  return result("INTERIM_FUNDING_OK", "中途用款-产品波动冲突", "none", [], ["interimFundingProbability"], ["lockupDays", "redeemArrivalDays"], { prob });
}
