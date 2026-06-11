import { KYCStatus, RiskLevel, RiskDecision, RiskScore } from '../types';

/**
 * WOE + Logistic Wind Control Scorecard Engine
 */

// WOE mappings as described in standard credit scorecards
export const WOE_SHEET = {
  kyc_verified: {
    true: 0.8,   // Verified is positive (safe)
    false: -1.2, // Unverified has penalty (risky)
  },
  ip_changes: (count: number): number => {
    if (count === 0) return 0.6;
    if (count <= 2) return 0.1;
    return -0.8; // Frequent IP shifts is signature of fraud
  },
  device_switches: (count: number): number => {
    if (count === 0) return 0.5;
    if (count === 1) return 0.1;
    return -0.9; // Fast device migration is anomalous
  },
  tx_frequency: (count: number): number => {
    if (count < 5) return 0.4;
    if (count <= 15) return 0.0;
    return -1.0; // Overly high speed automated transaction spike
  },
  blacklist_hit: {
    true: -3.0,  // Severe penalty!
    false: 0.7   // Clean record
  }
};

interface ScorecardInput {
  kycStatus: KYCStatus;
  ipChanges: number;
  deviceSwitches: number;
  txFrequency: number;
  blacklistHit: boolean;
}

/**
 * Executes a static scorecard running WOE Binning and Logistic Regression mapping to Credit Score Scaling:
 * risk_score = A - B * ln(PD / (1 - PD))
 * Let A = 50, B = 10.
 * Default weights w_i = 1.0, Intercept b = 0.
 * Therefore, ln(PD / (1 - PD)) = sum(w_i * WOE_i)
 * Which simplifies risk_score to: A - B * sum(WOE_i)
 * Clip the outputs to [0, 100].
 */
export function calculateRiskScore(input: ScorecardInput): {
  score: number;
  pd: number;
  level: RiskLevel;
  decision: RiskDecision;
  breakdown: string;
} {
  const isKycVerified = input.kycStatus === KYCStatus.VERIFIED;
  const woeKyc = isKycVerified ? WOE_SHEET.kyc_verified.true : WOE_SHEET.kyc_verified.false;
  const woeIp = WOE_SHEET.ip_changes(input.ipChanges);
  const woeDevice = WOE_SHEET.device_switches(input.deviceSwitches);
  const woeTx = WOE_SHEET.tx_frequency(input.txFrequency);
  const woeBlacklist = input.blacklistHit ? WOE_SHEET.blacklist_hit.true : WOE_SHEET.blacklist_hit.false;

  // sum(w_i * WOE_i)
  const sumWoe = woeKyc + woeIp + woeDevice + woeTx + woeBlacklist;

  // Probability of Default (PD) using standard Logistic Sigmoid
  // PD = 1 / (1 + e^(sumWoe)) which means as WOE increases (safer), PD decreases.
  // Wait, if sumWoe represents safety, then PD = 1 / (1 + e^sumWoe) decreases as sumWoe increases.
  const pd = 1 / (1 + Math.exp(sumWoe));

  // Score Scaling: A - B * ln(PD / (1 - PD))
  // Since ln(PD / (1 - PD)) = ln(1 / e^sumWoe) = -sumWoe.
  // Therefore, risk_score = A + B * sumWoe. More positive sumWoe means higher card score (safer).
  const A = 55;
  const B = 10;
  let rawScore = Math.round(A + B * sumWoe);
  
  // Guarantee boundary conditions
  const score = Math.max(0, Math.min(100, rawScore));

  // Risk Classification Levels & Decisions
  let level: RiskLevel;
  let decision: RiskDecision;

  if (score >= 80) {
    level = RiskLevel.LOW;
    decision = RiskDecision.ALLOW;
  } else if (score >= 50) {
    level = RiskLevel.MEDIUM;
    decision = RiskDecision.REVIEW;
  } else if (score >= 20) {
    level = RiskLevel.HIGH;
    decision = RiskDecision.MANUAL_REVIEW;
  } else {
    level = RiskLevel.CRITICAL;
    decision = RiskDecision.BLOCK;
  }

  // Generate audit explanations describing exact WOE weight mappings
  const breakdown = `【WOE评分卡拆解】
1. KYC状态: ${input.kycStatus} (WOE: ${woeKyc.toFixed(2)})
2. IP变化率: ${input.ipChanges} 次 (WOE: ${woeIp.toFixed(2)})
3. 设备变更率: ${input.deviceSwitches} 次 (WOE: ${woeDevice.toFixed(2)})
4. 1分钟交易频次: ${input.txFrequency} 次 (WOE: ${woeTx.toFixed(2)})
5. 黑名单库检索: ${input.blacklistHit ? '命中(Blacklist Hit)' : '未命中'} (WOE: ${woeBlacklist.toFixed(2)})
计算总效用(Sum WOE): ${sumWoe.toFixed(2)}。
量化违约率(PD): ${(pd * 100).toFixed(2)}%。
量化信用风险评分(Mapped Credit Score): ${score}。
对应风险级别为 【${level}】，执行系统建议指令为：${decision}。`;

  return {
    score,
    pd,
    level,
    decision,
    breakdown,
  };
}

/**
 * Real-time transaction rule evaluation engine (事中风控规则引擎)
 */
export function evaluateTransactionRisk(params: {
  amount: number;
  assetType: string;
  assetRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  userKycStatus: KYCStatus;
  userRiskScore: number;
  blacklistHit: boolean;
  recentTxCount1Min: number;
  historicalAvgTxAmount: number;
}): {
  decision: RiskDecision;
  reason: string;
} {
  // Rule 0: KYC State Admission Pre-requisites
  if (params.userKycStatus !== KYCStatus.VERIFIED) {
    return {
      decision: RiskDecision.BLOCK,
      reason: `【KYC未合规准入拦截】交易发起人当前KYC状态为 ${params.userKycStatus}。按合规准入规范，只有 VERIFIED 通过认证用户才允许交易发钞。`
    };
  }

  // Rule 1: Static wind control scorecard decision mapping
  if (params.userRiskScore < 20) {
    return {
      decision: RiskDecision.BLOCK,
      reason: `【静态风控评级极高拦截】该用户风控得分仅为 ${params.userRiskScore}，处于 Critical 警戒。直接全局 BLOCK 任何发钞行为。`
    };
  }

  // Rule 2: Blacklist identification
  if (params.blacklistHit) {
    return {
      decision: RiskDecision.BLOCK,
      reason: '【黑名单名单直接命中】匹配到高危洗钱/欺诈库，交易直接拦截执行 BLOCK。'
    };
  }

  // Rule 3: Product suitability by score band.
  const assetRiskLevel = params.assetRiskLevel || 'HIGH';
  const scoreAllowsAsset =
    params.userRiskScore >= 80 ||
    (params.userRiskScore >= 50 && (assetRiskLevel === 'LOW' || assetRiskLevel === 'MEDIUM')) ||
    (params.userRiskScore >= 20 && assetRiskLevel === 'LOW');

  if (!scoreAllowsAsset) {
    const allowedRange =
      params.userRiskScore >= 50
        ? 'LOW/MEDIUM'
        : params.userRiskScore >= 20
          ? 'LOW'
          : 'NONE';
    return {
      decision: RiskDecision.BLOCK,
      reason: `【产品适当性拦截】当前风控分数 ${params.userRiskScore}，仅允许申购 ${allowedRange} 风险产品；本次标的 [${params.assetType}] 识别为 ${assetRiskLevel} 风险，超出准入范围，交易 BLOCK。`
    };
  }

  // Rule 4: Velocity Abuse Control checking frequency
  if (params.recentTxCount1Min >= 5) {
    return {
      decision: RiskDecision.REVIEW,
      reason: `【短时异常高频交易熔断】1分钟内连续发起了 ${params.recentTxCount1Min} 次交易申请，超过防刷额度 (>=5)，进入人工 REVIEW 审核队列。`
    };
  }

  // Rule 5: Volume Deviation Checking (Amount is 3x higher than average history deposit/write)
  if (params.historicalAvgTxAmount > 0 && params.amount > params.historicalAvgTxAmount * 3) {
    return {
      decision: RiskDecision.STEP_UP,
      reason: `【大额交易偏离度熔断】该笔交易申请金额 ${params.amount}，已超过您历史均值交易额 ${params.historicalAvgTxAmount.toFixed(0)} 的 3 倍以上。安全要求，需触发二次增强式身份验证 (STEP_UP OTP)`
    };
  }

  // Default ALLOW
  return {
    decision: RiskDecision.ALLOW,
    reason: `符合各项安全规则配额，风控系统建议放行交易 (ALLOW)。`
  };
}
