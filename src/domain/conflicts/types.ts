import type { DerivedUserProfile } from "@/domain/profile/types";

export type ConflictLevel = "none" | "low" | "medium" | "high";
export type ProductSnapshot = {
  id: string;
  name: string;
  productType: string;
  historicalMaxDrawdown: number;
  hasLockup: boolean;
  lockupDays: number;
  earliestRedeemDate: Date | string | null;
  redeemArrivalDays: number;
  riskLevel: string;
};
export type RecognitionSnapshot = {
  intent: "了解" | "买入" | "卖出" | "调整" | "复盘" | "unknown";
  emotion: "平静" | "恐慌" | "兴奋" | "焦虑" | "unknown";
  executionStage: "了解中" | "考虑中" | "即将执行" | "已执行" | "unknown";
  confidence: number;
};
export type ConflictContext = {
  profile: DerivedUserProfile;
  product: ProductSnapshot | null;
  recognition: RecognitionSnapshot;
  operation: {
    type: "买入" | "卖出" | "调整" | "无操作" | "unknown";
    amount: number | null;
    fundRatio: number | null;
  };
};
export type ConflictResult = {
  conflictType: string;
  conflictLevel: ConflictLevel;
  ruleCode: string;
  reasons: string[];
  relatedUserFields: string[];
  relatedProductFields: string[];
  evidence: Record<string, unknown>;
};

export const levelRank: Record<ConflictLevel, number> = { none: 0, low: 1, medium: 2, high: 3 };
