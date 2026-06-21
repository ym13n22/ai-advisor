import type { ConflictContext, ConflictResult } from "../types";
import { result } from "./helpers";

export function goalRigidityRule(ctx: ConflictContext): ConflictResult {
  const drawdown = ctx.product?.historicalMaxDrawdown;
  if (drawdown == null) return result("GOAL_RIGIDITY_MISSING", "目标刚性-产品波动冲突", "none", ["缺少产品回撤"], ["goalPriority"], ["historicalMaxDrawdown"], {});
  if (ctx.profile.goalPriority !== "高" || drawdown <= 0.1) return result("GOAL_RIGIDITY_OK", "目标刚性-产品波动冲突", "none", [], ["goalPriority"], ["historicalMaxDrawdown"], { priority: ctx.profile.goalPriority, drawdown });
  const level = drawdown > 0.2 ? "high" : "medium";
  return result("GOAL_RIGIDITY_VOLATILE", "目标刚性-产品波动冲突", level, ["高优先级目标与较高波动产品不一致"], ["goalPriority"], ["historicalMaxDrawdown"], { priority: ctx.profile.goalPriority, drawdown });
}
