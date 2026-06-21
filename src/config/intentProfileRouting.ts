import type { DerivedUserProfile } from "@/domain/profile/types";

export type Intent = "了解" | "买入" | "卖出" | "调整" | "复盘" | "unknown";

export const intentProfileRouting: Record<Exclude<Intent, "unknown">, string[]> = {
  "了解": ["investmentExperienceLevel", "productTypes", "selfDecisionLevel"],
  "买入": ["goalType", "goalPriority", "effectiveInvestmentMonths", "effectiveMaxLossRatio", "riskBufferAbility", "currentPreparedAmount", "monthlyInvestment"],
  "卖出": ["goalType", "goalPriority", "earliestUseDate", "postLossFundingNeed", "recoveryWaitMonths", "currentPreparedAmount"],
  "调整": ["goalType", "goalPriority", "effectiveInvestmentMonths", "effectiveMaxLossRatio", "riskBufferAbility", "fundingGap", "currentPreparedAmount"],
  "复盘": ["goalType", "goalCompletionRate", "goalFeasibility", "investmentExperienceLevel", "maxDrawdownExperience", "marketCycleExperience"]
};

export function routeProfileFields(intent: Intent, profile: DerivedUserProfile) {
  const requiredFields = intent === "unknown" ? [] : intentProfileRouting[intent];
  const availableFields = requiredFields.filter((field) => {
    const value = (profile as unknown as Record<string, unknown>)[field];
    return value !== undefined && value !== null && value !== "";
  });
  return {
    requiredFields,
    availableFields,
    missingFields: requiredFields.filter((field) => !availableFields.includes(field)),
    routingSuccess: requiredFields.length > 0 && availableFields.length === requiredFields.length
  };
}
