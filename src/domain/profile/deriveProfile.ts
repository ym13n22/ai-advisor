import type { BaseProfile, DerivedUserProfile, GoalProfile } from "./types";

const monthsBetween = (future: Date | string) => {
  const now = new Date();
  const date = new Date(future);
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
};

const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

const productTypesCount = (value: unknown) => {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.length;
    } catch {
      return value.split(",").filter(Boolean).length;
    }
  }
  return 0;
};

export function deriveProfile(profile: BaseProfile, goal: GoalProfile): DerivedUserProfile {
  const debtServiceRatio = ratio(profile.monthlyDebtPayment, profile.monthlyAfterTaxIncome);
  const emergencyCoverageMonths = ratio(profile.emergencyFund, profile.monthlyNecessaryExpense);
  const stabilityScore = profile.incomeStability === "稳定" ? 2 : profile.incomeStability === "一般" ? 1 : 0;
  const debtScore = debtServiceRatio < 0.3 ? 2 : debtServiceRatio <= 0.5 ? 1 : 0;
  const emergencyScore = emergencyCoverageMonths >= 6 ? 2 : emergencyCoverageMonths >= 3 ? 1 : 0;
  const reserveScore = ratio(profile.otherAvailableFunds, Math.max(1, goal.targetAmount - goal.currentPreparedAmount)) >= 0.5 ? 2 : ratio(profile.otherAvailableFunds, Math.max(1, goal.targetAmount - goal.currentPreparedAmount)) > 0 ? 1 : 0;
  const bufferScore = stabilityScore + debtScore + emergencyScore + reserveScore;
  const riskBufferAbility = bufferScore >= 6 ? "强" : bufferScore >= 3 ? "中" : "弱";
  const availableAtTarget = goal.currentPreparedAmount + goal.oneTimeAdditional + goal.monthlyInvestment * goal.targetMonths;
  const fundingGap = Math.max(0, goal.targetAmount - availableAtTarget);
  const fundingGapRatio = ratio(fundingGap, goal.targetAmount);
  const goalCompletionRate = ratio(goal.currentPreparedAmount, goal.targetAmount);
  const goalFeasibility = fundingGapRatio <= 0.2 ? "高" : fundingGapRatio <= 0.5 ? "中" : "低";
  const effectiveInvestmentMonths = monthsBetween(profile.earliestUseDate);
  const effectiveMaxLossAmount = Math.min(profile.maxLossAmount, goal.currentPreparedAmount * profile.maxLossRatio);
  const effectiveMaxLossRatio = ratio(effectiveMaxLossAmount, Math.max(1, goal.currentPreparedAmount));
  const experienceBreadth = productTypesCount(profile.productTypes);
  const investmentExperienceLevel = profile.investmentYears >= 5 ? "成熟" : profile.investmentYears >= 1 ? "进阶" : "新手";
  const priorityScore = goal.postponeScore + goal.amountAdjustScore + goal.fallbackScore + goal.consequenceScore;
  const goalPriority = priorityScore >= 6 ? "高" : priorityScore >= 3 ? "中" : "低";
  return {
    ...profile,
    ...goal,
    debtServiceRatio,
    emergencyCoverageMonths,
    riskBufferAbility,
    fundingGap,
    fundingGapRatio,
    goalCompletionRate,
    goalFeasibility,
    effectiveInvestmentMonths,
    effectiveMaxLossAmount,
    effectiveMaxLossRatio,
    experienceBreadth,
    investmentExperienceLevel,
    goalPriority
  };
}
