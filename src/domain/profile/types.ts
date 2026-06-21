export type BaseProfile = {
  userId: string;
  emergencyFund: number;
  monthlyNecessaryExpense: number;
  incomeStability: string;
  monthlyDebtPayment: number;
  monthlyAfterTaxIncome: number;
  otherAvailableFunds: number;
  earliestUseDate: Date | string;
  goalUseDate: Date | string;
  delayTolerance: string;
  interimFundingProbability: number;
  maxLossAmount: number;
  maxLossRatio: number;
  postLossFundingNeed: string;
  recoveryWaitMonths: number;
  investmentYears: number;
  productTypes: unknown;
  maxDrawdownExperience: string;
  marketCycleExperience: string;
  selfDecisionLevel: string;
  companionType: string;
  proactiveContactPreference: string;
};

export type GoalProfile = {
  goalType: string;
  targetAmount: number;
  targetMonths: number;
  currentPreparedAmount: number;
  monthlyInvestment: number;
  oneTimeAdditional: number;
  postponeScore: number;
  amountAdjustScore: number;
  fallbackScore: number;
  consequenceScore: number;
};

export type DerivedUserProfile = BaseProfile &
  GoalProfile & {
    debtServiceRatio: number;
    emergencyCoverageMonths: number;
    riskBufferAbility: "弱" | "中" | "强";
    fundingGap: number;
    fundingGapRatio: number;
    goalCompletionRate: number;
    goalFeasibility: "低" | "中" | "高";
    effectiveInvestmentMonths: number;
    effectiveMaxLossAmount: number;
    effectiveMaxLossRatio: number;
    experienceBreadth: number;
    investmentExperienceLevel: "新手" | "进阶" | "成熟";
    goalPriority: "低" | "中" | "高";
  };
