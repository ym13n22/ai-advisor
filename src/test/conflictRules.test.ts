import { describe, expect, it } from "vitest";
import { deriveProfile } from "@/domain/profile/deriveProfile";
import { evaluateConflicts } from "@/domain/conflicts/evaluateConflicts";
import type { ConflictContext, ProductSnapshot, RecognitionSnapshot } from "@/domain/conflicts/types";

const baseProfile = deriveProfile({
  userId: "u1",
  emergencyFund: 12000,
  monthlyNecessaryExpense: 6000,
  incomeStability: "不稳定",
  monthlyDebtPayment: 5000,
  monthlyAfterTaxIncome: 12000,
  otherAvailableFunds: 20000,
  earliestUseDate: "2031-06-01",
  goalUseDate: "2031-06-01",
  delayTolerance: "不可延后",
  interimFundingProbability: 80,
  maxLossAmount: 10000,
  maxLossRatio: 0.1,
  postLossFundingNeed: "短期使用",
  recoveryWaitMonths: 3,
  investmentYears: 2,
  productTypes: ["货币基金", "债券基金"],
  maxDrawdownExperience: "5%-10%",
  marketCycleExperience: "部分经历",
  selfDecisionLevel: "需要陪伴",
  companionType: "风险提醒",
  proactiveContactPreference: "重要节点触达"
}, {
  goalType: "买房首付",
  targetAmount: 500000,
  targetMonths: 60,
  currentPreparedAmount: 100000,
  monthlyInvestment: 3000,
  oneTimeAdditional: 20000,
  postponeScore: 2,
  amountAdjustScore: 2,
  fallbackScore: 1,
  consequenceScore: 2
});

const product = (historicalMaxDrawdown: number, extra: Partial<ProductSnapshot> = {}): ProductSnapshot => ({
  id: "p",
  name: "测试产品",
  productType: "权益",
  historicalMaxDrawdown,
  hasLockup: false,
  lockupDays: 0,
  earliestRedeemDate: null,
  redeemArrivalDays: 3,
  riskLevel: "高",
  ...extra
});
const recognition = (extra: Partial<RecognitionSnapshot> = {}): RecognitionSnapshot => ({ intent: "买入", emotion: "平静", executionStage: "考虑中", confidence: 1, ...extra });
const ctx = (overrides: Partial<ConflictContext> = {}): ConflictContext => ({
  profile: baseProfile,
  product: product(0.07),
  recognition: recognition(),
  operation: { type: "买入", amount: null, fundRatio: null },
  ...overrides
});
const byCode = (context: ConflictContext, code: string) => evaluateConflicts(context).results.find((item) => item.ruleCode === code);

describe("conflict rules", () => {
  it("does not trigger when drawdown is inside tolerance", () => {
    expect(evaluateConflicts(ctx({ product: product(0.01) })).overallConflictLevel).toBe("low");
  });
  it("triggers low loss tolerance near boundary", () => {
    expect(byCode(ctx({ product: product(0.11) }), "LOSS_TOLERANCE_OVER")?.conflictLevel).toBe("low");
  });
  it("triggers medium loss tolerance", () => {
    expect(byCode(ctx({ product: product(0.13) }), "LOSS_TOLERANCE_OVER")?.conflictLevel).toBe("medium");
  });
  it("triggers high loss tolerance", () => {
    expect(byCode(ctx({ product: product(0.25) }), "LOSS_TOLERANCE_OVER")?.conflictLevel).toBe("high");
  });
  it("handles missing product fields without throwing", () => {
    expect(evaluateConflicts(ctx({ product: null })).overallConflictLevel).toBe("none");
  });
  it("triggers liquidity high for short need and long lockup", () => {
    const shortProfile = { ...baseProfile, effectiveInvestmentMonths: 1 };
    expect(byCode(ctx({ profile: shortProfile, product: product(0.08, { hasLockup: true, lockupDays: 180 }) }), "LIQUIDITY_LOCKUP_OVER_NEED")?.conflictLevel).toBe("high");
  });
  it("triggers liquidity medium", () => {
    const shortProfile = { ...baseProfile, effectiveInvestmentMonths: 1 };
    expect(byCode(ctx({ profile: shortProfile, product: product(0.08, { hasLockup: true, lockupDays: 61 }) }), "LIQUIDITY_LOCKUP_OVER_NEED")?.conflictLevel).toBe("medium");
  });
  it("triggers goal rigidity medium", () => {
    expect(byCode(ctx({ product: product(0.15) }), "GOAL_RIGIDITY_VOLATILE")?.conflictLevel).toBe("medium");
  });
  it("triggers goal rigidity high", () => {
    expect(byCode(ctx({ product: product(0.3) }), "GOAL_RIGIDITY_VOLATILE")?.conflictLevel).toBe("high");
  });
  it("triggers intermediate funding medium", () => {
    expect(byCode(ctx({ product: product(0.08, { lockupDays: 30, redeemArrivalDays: 4 }) }), "INTERIM_FUNDING_MEDIUM")?.conflictLevel).toBe("medium");
  });
  it("triggers intermediate funding high", () => {
    expect(byCode(ctx({ product: product(0.08, { lockupDays: 60, redeemArrivalDays: 8 }) }), "INTERIM_FUNDING_HIGH")?.conflictLevel).toBe("high");
  });
  it("triggers weak buffer low", () => {
    expect(byCode(ctx({ product: product(0.03) }), "RISK_BUFFER_WEAK_LOW")?.conflictLevel).toBe("low");
  });
  it("triggers weak buffer medium", () => {
    expect(byCode(ctx({ product: product(0.07) }), "RISK_BUFFER_WEAK_MEDIUM")?.conflictLevel).toBe("medium");
  });
  it("triggers funding gap high", () => {
    expect(byCode(ctx({ profile: { ...baseProfile, fundingGapRatio: 0.6 }, product: product(0.25) }), "FUNDING_GAP_HIGH")?.conflictLevel).toBe("high");
  });
  it("triggers panic sell high", () => {
    expect(byCode(ctx({ recognition: recognition({ intent: "卖出", emotion: "恐慌" }), operation: { type: "卖出", amount: 100000, fundRatio: 1 } }), "PANIC_SELL_LONG_GOAL")?.conflictLevel).toBe("high");
  });
  it("triggers excited buy high", () => {
    expect(byCode(ctx({ product: product(0.45), recognition: recognition({ emotion: "兴奋" }) }), "EXCITED_BUY_OVER_TOLERANCE")?.conflictLevel).toBe("high");
  });
});
