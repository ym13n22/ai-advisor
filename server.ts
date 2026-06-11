import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import db from './src/server/db';
import { 
  calculateRiskScore, 
  evaluateTransactionRisk 
} from './src/server/rules';
import AIService from './src/server/ai';
import { 
  UserRole, 
  KYCStatus, 
  RiskLevel, 
  RiskDecision, 
  KYCProfile, 
  RiskScore, 
  Transaction, 
  BehaviorLog,
  DepositRecord
} from './src/types';

// Load environment config
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
let systemConfig = {
  defaultCurrency: 'CNY',
  maxDepositAmount: 1000000,
  maxTransactionAmount: 5000000,
  kycExpiryReminderDays: 30,
  allowUnverifiedMockDeposit: false,
  enableAiRecommendation: true,
  mockMode: true,
  announcement: 'RiskMind AI 演示环境运行正常'
};

// Enable JSON bodies
app.use(express.json());

// Helper: Wrap uniform responses
function createResponse<T>(success: boolean, data: T, message: string = '') {
  return {
    success,
    data,
    message
  };
}

function resolveAssetRiskLevel(assetType: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  const normalizedAsset = String(assetType || '').toLowerCase();
  const matchedProduct = db.getProducts.find(prod => {
    const productName = prod.name.toLowerCase();
    return productName === normalizedAsset ||
      productName.includes(normalizedAsset) ||
      normalizedAsset.includes(productName);
  });

  if (matchedProduct) return matchedProduct.riskLevel;

  if (/crypto|alpha|leveraged|杠杆|加密|高频|进取/.test(normalizedAsset)) return 'HIGH';
  if (/tech|growth|balanced|mix|科技|成长|混合|权益|宏观/.test(normalizedAsset)) return 'MEDIUM';
  if (/money|bond|cash|deposit|货币|债|存款|稳健|信用/.test(normalizedAsset)) return 'LOW';

  return 'HIGH';
}

function isProductEligibleForScore(score: number, riskLevel: 'LOW' | 'MEDIUM' | 'HIGH') {
  if (score >= 80) return true;
  if (score >= 50) return riskLevel === 'LOW' || riskLevel === 'MEDIUM';
  if (score >= 20) return riskLevel === 'LOW';
  return false;
}

function isKycExpired(profile?: KYCProfile | null) {
  const expiryDate = profile?.idDocumentExpiresAt;
  if (!expiryDate) return true;
  return new Date(`${expiryDate}T23:59:59`).getTime() < Date.now();
}

function hasVerifiedKycHistory(userId: string) {
  return db.getBehaviorLogs.some(log => {
    if (log.actionType !== 'KYC_AUDIT') return false;
    const auditContent = `${log.requestPayload || ''} ${log.responseResult || ''}`;
    return (log.userId === userId || auditContent.includes(userId)) && /VERIFIED/i.test(auditContent);
  });
}

function getKycTradingAccess(profile?: KYCProfile | null) {
  if (!profile) return { active: false, expiresAt: undefined as string | undefined };
  if (profile.status === KYCStatus.VERIFIED && !profile.idDocumentExpiresAt) {
    return { active: true, expiresAt: undefined as string | undefined };
  }

  const verifiedExpiry = profile.status === KYCStatus.VERIFIED
    ? profile.idDocumentExpiresAt
    : profile.lastVerifiedExpiresAt
      || profile.accessRetainedUntil
      || (
        profile.resubmitted
        && [KYCStatus.PENDING, KYCStatus.MANUAL_REVIEW].includes(profile.status)
        && hasVerifiedKycHistory(profile.userId)
          ? profile.idDocumentExpiresAt
          : undefined
      );

  const active = !!verifiedExpiry
    && profile.status !== KYCStatus.REJECTED
    && new Date(`${verifiedExpiry}T23:59:59`).getTime() >= Date.now();

  return { active, expiresAt: active ? verifiedExpiry : undefined };
}

function getEffectiveRiskResult(profile: KYCProfile | undefined, scoreCard: RiskScore | undefined) {
  if (!scoreCard) return null;
  return calculateRiskScore({
    kycStatus: getKycTradingAccess(profile).active ? KYCStatus.VERIFIED : profile?.status || KYCStatus.INIT,
    ipChanges: scoreCard.ipChanges,
    deviceSwitches: scoreCard.deviceSwitches,
    txFrequency: scoreCard.txFrequency,
    blacklistHit: scoreCard.blacklistHit
  });
}

function hasAtMostTwoDecimals(value: unknown) {
  return /^\d+(\.\d{1,2})?$/.test(String(value).trim());
}

function isValidDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function normalizeDateOnly(value: unknown) {
  const normalized = String(value || '').trim().replace(/[/.]/g, '-');
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return normalized;
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function isBeforeToday(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${value}T00:00:00`).getTime() < today.getTime();
}

// Request logging & Audit log decorator
function auditLog(actionType: string, serviceName: string) {
  return (req: any, res: any, next: any) => {
    const originalJson = res.json;
    res.json = function (body: any) {
      const user = req.user;
      res.json = originalJson; // Restore
      
      try {
        if (body && body.success) {
          db.addBehaviorLog({
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            userId: user ? user.id : 'anonymous',
            username: user ? user.username : 'anonymous',
            actionType,
            timestamp: new Date().toISOString(),
            serviceName,
            requestPayload: JSON.stringify({ body: req.body, query: req.query, params: req.params }),
            responseResult: JSON.stringify(body),
            riskFlag: body.data?.status === RiskDecision.BLOCK || body.data?.status === 'REJECTED' || body.data?.status === 'BLOCK'
          });
        }
      } catch (err) {
        console.error('Audit serialization failed', err);
      }
      return res.json(body);
    };
    next();
  };
}

// Simple security / Session middleware
function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json(createResponse(false, null, '未携带身份凭证，拒绝访问 (Missing Auth Token)'));
  }
  const token = authHeader.replace(/^Bearer\s+/, '');
  const user = db.getUsers.find(u => u.id === token);
  if (!user) {
    return res.status(401).json(createResponse(false, null, '凭证无效或已过期，请重新登录'));
  }
  req.user = user;
  next();
}

app.post('/api/ai/test', authMiddleware, auditLog('AI_CONNECTION_TEST', 'AIConfigService'), (req: any, res) => {
  if (req.user.role !== UserRole.ADMIN) return res.status(403).json(createResponse(false, null, '仅 Admin 可以测试 AI 连接。'));
  res.json(createResponse(true, { provider: process.env.AI_PROVIDER || 'mock', connected: true }, '连接测试成功（MVP 模拟）。'));
});

app.get('/api/admin/system-config', authMiddleware, (req: any, res) => {
  if (req.user.role !== UserRole.ADMIN) return res.status(403).json(createResponse(false, null, '仅 Admin 可以查看系统配置。'));
  res.json(createResponse(true, systemConfig));
});

app.post('/api/admin/system-config', authMiddleware, auditLog('SYSTEM_CONFIG_UPDATE', 'SystemConfigService'), (req: any, res) => {
  if (req.user.role !== UserRole.ADMIN) return res.status(403).json(createResponse(false, null, '仅 Admin 可以修改系统配置。'));
  systemConfig = { ...systemConfig, ...req.body };
  res.json(createResponse(true, systemConfig, '系统配置已保存。'));
});

app.post('/api/admin/demo-reset', authMiddleware, auditLog('DEMO_DATA_RESET', 'DemoDataService'), (req: any, res) => {
  if (req.user.role !== UserRole.ADMIN) return res.status(403).json(createResponse(false, null, '仅 Admin 可以操作演示数据。'));
  const { section } = req.body;
  if (section === 'all' || section === 'defaults') {
    db.reset();
    return res.json(createResponse(true, null, '演示数据已恢复为默认状态。'));
  }
  if (!db.resetDemoSection(section)) return res.status(400).json(createResponse(false, null, '不支持的重置范围。'));
  res.json(createResponse(true, null, '指定演示数据已重置。'));
});

/**
 * =====================================
 * API ENDPOINTS SECTION (Swagger/Pydantic style)
 * =====================================
 */

/**
 * 0. Swagger Schema Docs Endpoint
 */
app.get('/api/swagger.json', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'RiskMind AI Financial Decision API Platform MVP',
      version: '1.0.0',
      description: '统一金融 AI 风控与用户增长决策服务架构'
    },
    paths: {
      '/api/auth/register': {
        post: {
          summary: '用户注册接口 (User Registration)',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { username: { type: 'string' }, password: { type: 'string' }, role: { type: 'string', enum: ['Admin', 'Risk Analyst', 'Growth Analyst', 'Trader'] } } } } }
          }
        }
      },
      '/api/auth/login': {
        post: {
          summary: 'JWT用户登录鉴权 (User Authenticated Login)',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { username: { type: 'string' }, password: { type: 'string' } } } } }
          }
        }
      },
      '/api/kyc/submit': {
        post: {
          summary: 'KYC 认证信息提交 (Submit KYC Information)',
          security: [{ BearerAuth: [] }]
        }
      },
      '/api/kyc/audit': {
        post: {
          summary: '高合规后台 KYC 手动审核流转 (Audit KYC Submission)',
          security: [{ BearerAuth: [] }]
        }
      },
      '/api/risk/evaluate': {
        post: {
          summary: '全要素 WOE + 逻辑回归风控卡评定 (Calculate Risk Card)',
          security: [{ BearerAuth: [] }]
        }
      },
      '/api/transactions/apply': {
        post: {
          summary: '实时事中风控多维拦截校验及触发发钞 (Apply Transaction)',
          security: [{ BearerAuth: [] }]
        }
      }
    }
  });
});

/**
 * 1. Auth Services
 */
app.post('/api/auth/register', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json(createResponse(false, null, '参数缺失：需填报用户名与密码'));
  }

  const normalizedRole = role || UserRole.TRADER;
  
  // Exclusiveness check
  const exists = db.getUsers.find(u => u.username === username);
  if (exists) {
    return res.status(400).json(createResponse(false, null, '此用户名已被注册，请更换'));
  }

  const newUser = {
    id: `user_${Date.now()}`,
    username: username.trim(),
    role: normalizedRole,
    createdAt: new Date().toISOString(),
    balance: normalizedRole === UserRole.TRADER ? 10000 : 0 // Seeding standard deposit balance
  };

  db.addUser(newUser);

  // Auto push seed register log to keep growth pipeline active
  db.addBehaviorLog({
    id: `log_${Date.now()}_reg`,
    userId: newUser.id,
    username: newUser.username,
    actionType: 'REGISTER',
    timestamp: new Date().toISOString(),
    serviceName: 'AuthService',
    requestPayload: JSON.stringify({ username, role: normalizedRole }),
    responseResult: JSON.stringify({ success: true, user: newUser }),
    riskFlag: false
  });

  return res.json(createResponse(true, { user: newUser, token: newUser.id }, '注册成功!'));
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json(createResponse(false, null, '用户名不能为空'));
  }

  // Pure demo matching
  const matchedUser = db.getUsers.find(u => u.username === username.trim());
  if (!matchedUser) {
    return res.status(401).json(createResponse(false, null, '用户名或密码无效'));
  }

  if (matchedUser.accountStatus === 'DISABLED') {
    return res.status(403).json(createResponse(false, null, '该账户已被管理员禁用。'));
  }

  // Record active session behaviors
  matchedUser.lastActiveAt = new Date().toISOString();
  db.save();

  db.addBehaviorLog({
    id: `log_${Date.now()}_login`,
    userId: matchedUser.id,
    username: matchedUser.username,
    actionType: 'LOGIN',
    timestamp: new Date().toISOString(),
    serviceName: 'AuthService',
    requestPayload: JSON.stringify({ username }),
    responseResult: JSON.stringify({ success: true }),
    riskFlag: false
  });

  return res.json(createResponse(true, { user: matchedUser, token: matchedUser.id }, '登录认证成功'));
});

app.get('/api/auth/me', authMiddleware, (req: any, res) => {
  // Return dynamic balance and profile
  const user = req.user;
  return res.json(createResponse(true, user));
});

app.post('/api/auth/deposit', authMiddleware, auditLog('DEPOSIT', 'AuthService'), (req: any, res) => {
  const user = req.user;
  if (user.role !== UserRole.TRADER) {
    return res.status(403).json(createResponse(false, null, '仅 Trader 可以使用充值功能。'));
  }
  const { amount, currency = 'CNY', paymentMethod = '模拟充值', remark } = req.body;
  const depositAmount = Number(amount);
  if (!amount || isNaN(depositAmount) || depositAmount <= 0) {
    return res.status(400).json(createResponse(false, null, '充值金额无效，请输入大于 0 的金额'));
  }
  if (!hasAtMostTwoDecimals(amount)) {
    return res.status(400).json(createResponse(false, null, '充值金额最多保留 2 位小数'));
  }
  if (depositAmount > 1000000) {
    return res.status(400).json(createResponse(false, null, '单笔充值金额不能超过 1,000,000'));
  }
  user.balance += depositAmount;
  if (!user.firstDepositAt) {
    user.firstDepositAt = new Date().toISOString();
  }
  const depositRecord: DepositRecord = {
    id: `dep_${Date.now()}`,
    userId: user.id,
    amount: depositAmount,
    currency: 'CNY',
    paymentMethod,
    status: 'SUCCESS',
    remark,
    createdAt: new Date().toISOString()
  };
  db.addDepositRecord(depositRecord);
  db.save();
  return res.json(createResponse(true, user, `充值成功，已增加模拟资金 ${depositAmount.toLocaleString()}`));
});

app.get('/api/auth/deposits', authMiddleware, (req: any, res) => {
  const user = req.user;
  if (user.role !== UserRole.TRADER) {
    return res.status(403).json(createResponse(false, null, '仅 Trader 可以查看充值记录。'));
  }
  const records = db.getDepositRecords.filter(record => record.userId === user.id);
  return res.json(createResponse(true, records));
});

/**
 * 2. KYC System
 */
app.post('/api/kyc/submit', authMiddleware, auditLog('KYC_SUBMIT', 'KYCService'), (req: any, res) => {
  const user = req.user;
  const { name, idNumber, nationality, idType } = req.body;
  const dob = normalizeDateOnly(req.body.dob);
  const idDocumentExpiresAt = normalizeDateOnly(req.body.idDocumentExpiresAt);
  const deviceInfo = String(req.headers['user-agent'] || req.body.deviceInfo || 'Unknown Browser');
  const ipAddress = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1').split(',')[0].trim();

  if (!name || !idNumber || !dob || !nationality || !idType || !idDocumentExpiresAt) {
    return res.status(400).json(createResponse(false, null, '字段校验未通过：请如实填写所有合规字段'));
  }
  if (!isValidDateOnly(idDocumentExpiresAt)) {
    return res.status(400).json(createResponse(false, null, '证件到期时间格式无效，请使用 YYYY-MM-DD'));
  }
  if (isBeforeToday(idDocumentExpiresAt)) {
    return res.status(400).json(createResponse(false, null, '该证件已过期，请使用有效证件重新提交。'));
  }

  const existingKyc = db.getKycProfiles.find(p => p.userId === user.id);
  const existingAccess = getKycTradingAccess(existingKyc);
  const retainExistingAccess = existingAccess.active;
  const newKyc: KYCProfile = {
    id: `kyc_${Date.now()}`,
    userId: user.id,
    name,
    idNumber,
    dob,
    nationality,
    idType,
    idDocumentExpiresAt,
    deviceInfo: deviceInfo || 'Unverified Device',
    ipAddress: ipAddress || '127.0.0.1',
    status: KYCStatus.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resubmitted: !!existingKyc,
    accessRetainedUntil: existingAccess.expiresAt,
    lastVerifiedExpiresAt: existingAccess.expiresAt,
    auditorComments: '等待风控分析员评估 (Awaiting auditing evaluation)'
  };

  db.addKycProfile(newKyc);

  // A valid VERIFIED profile keeps its existing score and trading access while an update is reviewed.
  if (!retainExistingAccess) {
    const computed = calculateRiskScore({
      kycStatus: KYCStatus.PENDING,
      ipChanges: 0,
      deviceSwitches: 0,
      txFrequency: 0,
      blacklistHit: false
    });

    db.addRiskScore({
      id: `score_${Date.now()}`,
      userId: user.id,
      ipChanges: 0,
      deviceSwitches: 0,
      txFrequency: 0,
      blacklistHit: false,
      score: computed.score,
      level: computed.level,
      pd: computed.pd,
      decision: computed.decision,
      explanation: '账户信息初始化初始评测完成。' + computed.breakdown,
      updatedAt: new Date().toISOString()
    });
  }

  return res.json(createResponse(
    true,
    newKyc,
    retainExistingAccess
      ? '认证资料更新已提交。原认证仍在有效期内，审核期间可继续交易。'
      : '提交认证成功，风控初筛评估已同步建立。'
  ));
});

// Admin Audits a submission
app.post('/api/kyc/audit', authMiddleware, auditLog('KYC_AUDIT', 'KYCService'), async (req: any, res) => {
  const user = req.user;
  // RBAC control
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.RISK_ANALYST) {
    return res.status(403).json(createResponse(false, null, '权限审查不足：仅支持管理员与风控分析组手动核准'));
  }

  const { kycId, status, comments } = req.body;
  if (!kycId || !status) {
    return res.status(400).json(createResponse(false, null, '缺失认证审阅状态 (Missing parameters)'));
  }

  // Pre-fetch KYC profile to check whose profile it is
  const kycProfile = db.getKycProfiles.find(p => p.id === kycId);
  if (!kycProfile) {
    return res.status(404).json(createResponse(false, null, '未查询到对应KYC申请工单'));
  }

  const targetUser = db.getUsers.find(u => u.id === kycProfile.userId);
  if (!targetUser) {
    return res.status(404).json(createResponse(false, null, '未查询到关联的用户信息'));
  }

  // Constraint 1: Risk Analyst must have VERIFIED KYC status themselves to audit others.
  if (user.role === UserRole.RISK_ANALYST) {
    const analystKyc = db.getKycProfiles.find(p => p.userId === user.id);
    if (!getKycTradingAccess(analystKyc).active) {
      return res.status(403).json(createResponse(false, null, '权限审查不足：作为风控分析师，在您自身的实名合规 KYC 认证核签通过（VERIFIED）之前，根据内锁机制，您无权帮他人执行任何 KYC 审定件操作。'));
    }
  }

  // Constraint 2: Risk Analyst can only audit/approve users who are Traders.
  if (user.role === UserRole.RISK_ANALYST && targetUser.role !== UserRole.TRADER) {
    return res.status(403).json(createResponse(false, null, '权限审查不足：风控分析师仅可以对 Trader（注册交易员）身份角色提交的实名合规进行审核。'));
  }

  // Constraint 3: Only Admin can audit/approve Growth Analysts or Risk Analysts.
  if (
    (targetUser.role === UserRole.RISK_ANALYST || targetUser.role === UserRole.GROWTH_ANALYST) &&
    user.role !== UserRole.ADMIN
  ) {
    return res.status(403).json(createResponse(false, null, '权限审查不足：风控分析组/增长分析组人员的系统内审 KYC 审定，必须由审计主管（Admin）亲自核签审批。'));
  }

  const previousStatus = kycProfile.status;
  const requestedStatus = status as KYCStatus;
  const expired = isKycExpired(kycProfile);
  const allowedTransitions: Partial<Record<KYCStatus, KYCStatus[]>> = {
    [KYCStatus.PENDING]: [KYCStatus.VERIFIED, KYCStatus.REJECTED, KYCStatus.MANUAL_REVIEW],
    [KYCStatus.MANUAL_REVIEW]: [KYCStatus.VERIFIED, KYCStatus.REJECTED],
    [KYCStatus.VERIFIED]: expired
      ? [KYCStatus.INIT, KYCStatus.MANUAL_REVIEW]
      : [KYCStatus.INIT],
    [KYCStatus.REJECTED]: [],
    [KYCStatus.INIT]: []
  };
  if (!(allowedTransitions[previousStatus] || []).includes(requestedStatus)) {
    return res.status(400).json(createResponse(false, null, `当前 KYC 状态 ${previousStatus} 不允许流转为 ${requestedStatus}。`));
  }
  if (
    [KYCStatus.REJECTED, KYCStatus.MANUAL_REVIEW, KYCStatus.INIT].includes(requestedStatus)
    && !String(comments || '').trim()
  ) {
    return res.status(400).json(createResponse(false, null, '拒绝、转人工核验或要求重新认证时必须填写原因。'));
  }
  req.body.auditContext = {
    targetUserId: targetUser.id,
    targetUsername: targetUser.username,
    previousStatus,
    newStatus: requestedStatus,
    reason: String(comments || '审核通过').trim()
  };

  const priorTradingAccess = getKycTradingAccess(kycProfile);
  if (priorTradingAccess.active && requestedStatus !== KYCStatus.REJECTED && requestedStatus !== KYCStatus.INIT) {
    kycProfile.lastVerifiedExpiresAt = priorTradingAccess.expiresAt;
  }

  const updatedKyc = db.updateKycStatus(kycId, requestedStatus, comments || '审核通过');
  if (!updatedKyc) {
    return res.status(404).json(createResponse(false, null, '未查询到对应KYC申请工单'));
  }

  // Recalculate User scorecard rating immediately to propagate VERIFIED status
  const targetUserId = updatedKyc.userId;
  const currentScorecard = db.getRiskScores.find(s => s.userId === targetUserId);
  const ipChanges = currentScorecard ? currentScorecard.ipChanges : 0;
  const deviceSwitches = currentScorecard ? currentScorecard.deviceSwitches : 0;
  const txFrequency = currentScorecard ? currentScorecard.txFrequency : 0;
  const blacklistHit = currentScorecard ? currentScorecard.blacklistHit : false;

  const result = calculateRiskScore({
    kycStatus: getKycTradingAccess(updatedKyc).active ? KYCStatus.VERIFIED : requestedStatus,
    ipChanges,
    deviceSwitches,
    txFrequency,
    blacklistHit
  });

  // Call AI Service to get premium CRO natural language breakdown
  const croExplanation = await AIService.explainRiskResult({
    username: targetUser ? targetUser.username : '匿名交易员',
    score: result.score,
    pd: result.pd,
    level: result.level,
    breakdown: result.breakdown
  });

  db.addRiskScore({
    id: `score_${Date.now()}`,
    userId: targetUserId,
    ipChanges,
    deviceSwitches,
    txFrequency,
    blacklistHit,
    score: result.score,
    level: result.level,
    pd: result.pd,
    decision: result.decision,
    explanation: croExplanation + '\n\n' + result.breakdown,
    updatedAt: new Date().toISOString()
  });

  return res.json(createResponse(true, updatedKyc, `KYC 状态已从 ${previousStatus} 更新为 ${requestedStatus}。`));
});

// Reset System state endpoint
app.post('/api/system/reset', authMiddleware, auditLog('SYSTEM_RESET', 'SystemService'), (req: any, res) => {
  const user = req.user;
  if (user.role !== UserRole.ADMIN) {
    return res.status(403).json(createResponse(false, null, '权限不足：仅主系统管理员（审计主管）有权发起全系统数据重置。'));
  }
  db.reset();
  return res.json(createResponse(true, null, '全系统数据与状态重置成功！已恢复初始环境。'));
});

app.get('/api/kyc/list', authMiddleware, (req: any, res) => {
  // Merge username and role into profiles
  const profiles = db.getKycProfiles.map(p => {
    const u = db.getUsers.find(user => user.id === p.userId);
    const tradingAccess = getKycTradingAccess(p);
    return {
      ...p,
      accessRetainedUntil: tradingAccess.expiresAt,
      tradingAccessActive: tradingAccess.active,
      tradingAccessExpiresAt: tradingAccess.expiresAt,
      username: u ? u.username : '未知用户',
      role: u ? u.role : 'Trader'
    };
  });
  return res.json(createResponse(true, profiles));
});

/**
 * 3. Wind Control Scorecard
 */
app.post('/api/risk/evaluate', authMiddleware, auditLog('RISK_EVALUATE', 'RiskCardService'), async (req: any, res) => {
  const { userId, ipChanges, deviceSwitches, txFrequency, blacklistHit } = req.body;
  if (!userId) {
    return res.status(400).json(createResponse(false, null, '缺少评测目标用户ID'));
  }

  const targetUser = db.getUsers.find(u => u.id === userId);
  const user = req.user;

  if (user.role !== UserRole.RISK_ANALYST) {
    return res.status(403).json(createResponse(false, null, '仅管理员或风控分析师可以使用评分卡实验室。'));
  }

  if (!targetUser || targetUser.role !== UserRole.TRADER) {
    return res.status(403).json(createResponse(false, null, '评分卡实验室仅允许选择 Trader 用户进行评测。'));
  }

  const profile = db.getKycProfiles.find(p => p.userId === userId);
  const kycStatus = getKycTradingAccess(profile).active ? KYCStatus.VERIFIED : profile?.status || KYCStatus.INIT;

  const result = calculateRiskScore({
    kycStatus,
    ipChanges: Number(ipChanges ?? 0),
    deviceSwitches: Number(deviceSwitches ?? 0),
    txFrequency: Number(txFrequency ?? 0),
    blacklistHit: !!blacklistHit
  });
  
  // High quality advisor summary
  const croExplanation = await AIService.explainRiskResult({
    username: targetUser ? targetUser.username : '未知用户',
    score: result.score,
    pd: result.pd,
    level: result.level,
    breakdown: result.breakdown
  });

  const scoreEntry: RiskScore = {
    id: `score_${Date.now()}`,
    userId,
    ipChanges: Number(ipChanges ?? 0),
    deviceSwitches: Number(deviceSwitches ?? 0),
    txFrequency: Number(txFrequency ?? 0),
    blacklistHit: !!blacklistHit,
    score: result.score,
    level: result.level,
    pd: result.pd,
    decision: result.decision,
    explanation: croExplanation + '\n\n' + result.breakdown,
    updatedAt: new Date().toISOString()
  };

  db.addRiskScore(scoreEntry);
  return res.json(createResponse(true, scoreEntry, '静态WOE+逻辑回归风控评分卡审算完成。'));
});

app.get('/api/risk/list', authMiddleware, (req: any, res) => {
  const user = req.user;
  if (user.role !== UserRole.RISK_ANALYST && user.role !== UserRole.TRADER) {
    return res.status(403).json(createResponse(false, null, '仅风控分析师可以查看评分卡结果。'));
  }
  const traderIds = new Set(db.getUsers.filter(u => u.role === UserRole.TRADER).map(u => u.id));
  const rawScores = user.role === UserRole.TRADER
    ? db.getRiskScores.filter(s => s.userId === user.id)
    : db.getRiskScores.filter(s => traderIds.has(s.userId));
  const scores = rawScores.map(s => {
    const u = db.getUsers.find(user => user.id === s.userId);
    const p = db.getKycProfiles.find(profile => profile.userId === s.userId);
    const effective = getEffectiveRiskResult(p, s);
    return {
      ...s,
      ...(effective ? {
        score: effective.score,
        level: effective.level,
        pd: effective.pd,
        decision: effective.decision
      } : {}),
      username: u ? u.username : '未知',
      kycStatus: getKycTradingAccess(p).active ? KYCStatus.VERIFIED : p?.status || KYCStatus.INIT
    };
  });
  return res.json(createResponse(true, scores));
});

/**
 * 4. Transaction Wind Control
 */
app.post('/api/transactions/apply', authMiddleware, auditLog('APPLY_TRANSACTION', 'TradeControlService'), (req: any, res) => {
  const user = req.user;
  if (user.role !== UserRole.TRADER) {
    return res.status(403).json(createResponse(false, null, '仅 Trader 可以发起交易申请。'));
  }
  const { amount, assetType } = req.body;

  if (!amount || !assetType) {
    return res.status(400).json(createResponse(false, null, '发钞申购参数不齐：请提供足额金额和标的类型'));
  }

  // Retrieve current user score configs
  const profile = db.getKycProfiles.find(p => p.userId === user.id);
  const scoreCard = db.getRiskScores.find(s => s.userId === user.id);

  const kycStatus = getKycTradingAccess(profile).active ? KYCStatus.VERIFIED : profile?.status || KYCStatus.INIT;
  const effectiveRisk = getEffectiveRiskResult(profile, scoreCard);
  const userScore = effectiveRisk ? effectiveRisk.score : 0;
  const blacklistHit = scoreCard ? scoreCard.blacklistHit : false;
  const assetRiskLevel = resolveAssetRiskLevel(assetType);

  // Compute stats on recent frequency in current memory (transactions in 1 min)
  const oneMinAgo = Date.now() - 60 * 1000;
  const recentCount = db.getTransactions.filter(
    tx => tx.userId === user.id && new Date(tx.createdAt).getTime() > oneMinAgo
  ).length;

  // Retrieve average historic volume
  const userPastTxs = db.getTransactions.filter(tx => tx.userId === user.id && tx.status === RiskDecision.ALLOW);
  const avgAmount = userPastTxs.length > 0 
    ? userPastTxs.reduce((sum, tx) => sum + tx.amount, 0) / userPastTxs.length 
    : 10000; // Seed default average representation if none

  // Run Rules Evaluator Engine!
  const evaluation = profile?.status === KYCStatus.VERIFIED && isKycExpired(profile)
    ? {
        decision: RiskDecision.BLOCK,
        reason: 'KYC已到期，账户暂不满足交易准入条件'
      }
    : evaluateTransactionRisk({
        amount: Number(amount),
        assetType,
        assetRiskLevel,
        userKycStatus: kycStatus,
        userRiskScore: userScore,
        blacklistHit,
        recentTxCount1Min: recentCount,
        historicalAvgTxAmount: avgAmount
      });

  // Apply Balance subtraction only if trade is approved
  if (evaluation.decision === RiskDecision.ALLOW) {
    if (user.balance < Number(amount)) {
      return res.status(400).json(createResponse(false, null, '申购失败：您的证券交易账户可用资金余额不足'));
    }
    user.balance -= Number(amount);
    
    // Growth trackers: trigger first deposit / first trade logic
    if (!user.firstDepositAt) user.firstDepositAt = new Date().toISOString();
    if (!user.firstTradeAt) user.firstTradeAt = new Date().toISOString();
    
    db.save();
  }

  const newTx: Transaction = {
    id: `tx_${Date.now()}`,
    userId: user.id,
    username: user.username,
    amount: Number(amount),
    assetType,
    status: evaluation.decision,
    reason: evaluation.reason,
    createdAt: new Date().toISOString()
  };

  db.addTransaction(newTx);

  return res.json(createResponse(true, newTx, `判定完毕：${evaluation.decision}`));
});

app.post('/api/transactions/step-up/confirm', authMiddleware, auditLog('CONFIRM_STEP_UP_TRANSACTION', 'TradeControlService'), (req: any, res) => {
  const user = req.user;
  const { txId } = req.body;

  if (!txId) {
    return res.status(400).json(createResponse(false, null, '缺少交易编号'));
  }

  const tx = db.getTransactions.find(t => t.id === txId && t.userId === user.id);
  if (!tx) {
    return res.status(404).json(createResponse(false, null, '未找到对应交易申请'));
  }

  if (tx.status !== RiskDecision.STEP_UP) {
    return res.status(400).json(createResponse(false, null, '当前交易不需要二次确认'));
  }

  if (user.balance < tx.amount) {
    tx.status = RiskDecision.BLOCK;
    tx.reason = '账户余额不足，二次确认后仍无法完成交易';
    db.save();
    return res.status(400).json(createResponse(false, tx, '账户余额不足，请先充值'));
  }

  user.balance -= tx.amount;
  if (!user.firstDepositAt) user.firstDepositAt = new Date().toISOString();
  if (!user.firstTradeAt) user.firstTradeAt = new Date().toISOString();
  tx.status = RiskDecision.ALLOW;
  tx.reason = 'Trader 已确认二次验证警告，交易已通过';
  db.save();

  return res.json(createResponse(true, tx, '二次确认完成，交易已通过'));
});

app.get('/api/transactions/list', authMiddleware, (req: any, res) => {
  const user = req.user;
  let txs = db.getTransactions;
  if (user.role === UserRole.TRADER) {
    txs = txs.filter(t => t.userId === user.id);
  } else if (user.role === UserRole.RISK_ANALYST) {
    const traderIds = new Set(db.getUsers.filter(u => u.role === UserRole.TRADER).map(u => u.id));
    txs = txs.filter(t => traderIds.has(t.userId));
  } else {
    return res.status(403).json(createResponse(false, null, '仅 Trader 或风控分析师可以查看交易记录。'));
  }
  return res.json(createResponse(true, txs));
});

app.post('/api/transactions/audit', authMiddleware, auditLog('AUDIT_TRANSACTION', 'TradeControlService'), (req: any, res) => {
  const user = req.user;
  const { txId, action, comment } = req.body;

  if (user.role !== UserRole.RISK_ANALYST) {
    return res.status(430).json(createResponse(false, null, '权限不足：只有风控分析员及主管有权对人工队列交易流水进行决策签批。'));
  }

  if (!txId || !action) {
    return res.status(400).json(createResponse(false, null, '请求参数不齐：请提供交易ID (txId) 以及具体判定指令 (action)'));
  }

  if (action !== RiskDecision.ALLOW && action !== RiskDecision.BLOCK) {
    return res.status(400).json(createResponse(false, null, '无效判定指令：仅支持 ALLOW (放行) 或 BLOCK (高危拦截) 动作。'));
  }

  // Find transaction
  const transactions = db.getTransactions;
  const tx = transactions.find(t => t.id === txId);
  if (!tx) {
    return res.status(444).json(createResponse(false, null, '交易查无此单：未检索到指定的流水记录。'));
  }

  if (tx.status !== RiskDecision.MANUAL_REVIEW && tx.status !== RiskDecision.REVIEW && tx.status !== RiskDecision.STEP_UP) {
    return res.status(400).json(createResponse(false, null, `交易状态不符：该笔交易当前判定为 [${tx.status}]，不能重复人工二次审计审判。`));
  }

  const targetUser = db.getUsers.find(u => u.id === tx.userId);
  if (!targetUser) {
    return res.status(404).json(createResponse(false, null, '交易所属账户已失效。'));
  }

  let isOverdraftApplied = false;
  let overdraftAmount = 0;

  if (action === RiskDecision.ALLOW) {
    if (targetUser.balance < tx.amount) {
      // In this simulated trading environment, if a high-value transaction is custom APPROVED by the risk supervisor,
      // we automatically provision a "Dynamic Sandbox Margin Credit" (沙盒等额特许授信/信用融资机制)
      // to cover the remaining balance, so that the demo trade registers successfully.
      isOverdraftApplied = true;
      overdraftAmount = tx.amount - targetUser.balance;
      targetUser.balance += overdraftAmount;
    }
    // Deduct
    targetUser.balance -= tx.amount;
  }

  // Update status and details
  tx.status = action;
  tx.reviewedBy = user.username;
  tx.reviewedAt = new Date().toISOString();
  tx.balanceDeducted = action === RiskDecision.ALLOW;
  tx.auditDetail = comment || '风控分析师人工处理完成';
  tx.reason = `【人工特验终审结论】
审核专员: ${user.username} (${user.role})
审核结论: ${action === RiskDecision.ALLOW ? '放行核准 (ALLOW)' : '强制拦截 (BLOCK)'}
裁决时间: ${new Date().toLocaleString()}
合规建议: ${comment || '经合规特验确认无虞，予以审结。'} ${isOverdraftApplied ? `\n⚠️ 【特权授信通融模式】系统监测到交易商账户余额不足，自动启动【沙盒特别双向授信】支持，授信注补额：$${overdraftAmount.toLocaleString()}。` : ''}

--------------------------------------------------
前置风控系统报告记录：
${tx.reason}`;

  db.save();

  return res.json(createResponse(true, tx, `交易流水人工特验审计完成：最终判定为：${action}`));
});

app.get('/api/admin/overview', authMiddleware, (req: any, res) => {
  if (req.user.role !== UserRole.ADMIN) return res.status(403).json(createResponse(false, null, '仅 Admin 可以查看全局管理概览。'));
  const today = new Date().toDateString();
  const todayTransactions = db.getTransactions.filter(tx => new Date(tx.createdAt).toDateString() === today);
  const countRole = (role: UserRole) => db.getUsers.filter(user => user.role === role).length;
  const countKyc = (status: KYCStatus) => db.getKycProfiles.filter(profile => profile.status === status).length;
  res.json(createResponse(true, {
    totalUsers: db.getUsers.length,
    traderCount: countRole(UserRole.TRADER),
    riskCount: countRole(UserRole.RISK_ANALYST),
    growthCount: countRole(UserRole.GROWTH_ANALYST),
    pendingKyc: db.getKycProfiles.filter(profile => [KYCStatus.PENDING, KYCStatus.MANUAL_REVIEW].includes(profile.status)).length,
    verifiedKyc: countKyc(KYCStatus.VERIFIED),
    rejectedKyc: countKyc(KYCStatus.REJECTED),
    pendingTransactions: db.getTransactions.filter(tx => [RiskDecision.REVIEW, RiskDecision.MANUAL_REVIEW, RiskDecision.STEP_UP].includes(tx.status)).length,
    todayTransactions: todayTransactions.length,
    todayBlocks: todayTransactions.filter(tx => tx.status === RiskDecision.BLOCK).length,
    todayReviewOrStepUp: todayTransactions.filter(tx => [RiskDecision.REVIEW, RiskDecision.MANUAL_REVIEW, RiskDecision.STEP_UP].includes(tx.status)).length,
    totalDeposits: db.getDepositRecords.filter(record => record.status === 'SUCCESS').reduce((sum, record) => sum + record.amount, 0),
    totalGmv: db.getTransactions.filter(tx => tx.status === RiskDecision.ALLOW).reduce((sum, tx) => sum + tx.amount, 0),
    aiProvider: process.env.AI_PROVIDER || 'mock',
    systemStatus: '运行正常'
  }));
});

app.get('/api/admin/users', authMiddleware, (req: any, res) => {
  if (req.user.role !== UserRole.ADMIN) return res.status(403).json(createResponse(false, null, '仅 Admin 可以管理用户。'));
  const users = db.getUsers.map(user => {
    const kyc = db.getKycProfiles.find(profile => profile.userId === user.id);
    const userTransactions = db.getTransactions.filter(tx => tx.userId === user.id);
    return {
      ...user,
      accountStatus: user.accountStatus || 'ACTIVE',
      kycStatus: kyc?.status || KYCStatus.INIT,
      kycName: kyc?.name || '',
      idDocumentExpiresAt: kyc?.idDocumentExpiresAt || '',
      transactionCount: userTransactions.length,
      transactionGmv: userTransactions.filter(tx => tx.status === RiskDecision.ALLOW).reduce((sum, tx) => sum + tx.amount, 0)
    };
  });
  res.json(createResponse(true, users));
});

app.post('/api/admin/users/status', authMiddleware, auditLog('USER_STATUS_UPDATE', 'AdminUserService'), (req: any, res) => {
  if (req.user.role !== UserRole.ADMIN) return res.status(403).json(createResponse(false, null, '仅 Admin 可以修改用户状态。'));
  const { userId, accountStatus } = req.body;
  if (!['ACTIVE', 'DISABLED'].includes(accountStatus)) return res.status(400).json(createResponse(false, null, '无效的账户状态。'));
  if (userId === req.user.id && accountStatus === 'DISABLED') return res.status(400).json(createResponse(false, null, '不能禁用当前登录的 Admin 账户。'));
  const updated = db.updateUserStatus(userId, accountStatus);
  if (!updated) return res.status(404).json(createResponse(false, null, '用户不存在。'));
  res.json(createResponse(true, updated, accountStatus === 'ACTIVE' ? '用户已启用。' : '用户已禁用。'));
});

app.get('/api/admin/transactions', authMiddleware, (req: any, res) => {
  if (req.user.role !== UserRole.ADMIN) return res.status(403).json(createResponse(false, null, '仅 Admin 可以查看全量交易终审数据。'));
  res.json(createResponse(true, db.getTransactions));
});

app.post('/api/admin/transactions/audit', authMiddleware, auditLog('ADMIN_TRANSACTION_FINAL_AUDIT', 'AdminTradeService'), (req: any, res) => {
  if (req.user.role !== UserRole.ADMIN) return res.status(403).json(createResponse(false, null, '仅 Admin 可以执行交易终审。'));
  const { txId, action, comment } = req.body;
  if (![RiskDecision.ALLOW, RiskDecision.BLOCK].includes(action)) return res.status(400).json(createResponse(false, null, '终审操作仅支持 ALLOW 或 BLOCK。'));
  const tx = db.getTransactions.find(item => item.id === txId);
  if (!tx) return res.status(404).json(createResponse(false, null, '交易不存在。'));
  if (![RiskDecision.REVIEW, RiskDecision.MANUAL_REVIEW, RiskDecision.STEP_UP].includes(tx.status)) {
    return res.status(400).json(createResponse(false, null, '终态交易只能查看，不能再次处理。'));
  }
  const targetUser = db.getUsers.find(user => user.id === tx.userId);
  if (!targetUser) return res.status(404).json(createResponse(false, null, '交易用户不存在。'));
  if (action === RiskDecision.ALLOW && targetUser.balance < tx.amount) {
    return res.status(400).json(createResponse(false, null, '用户余额不足，无法终审放行。'));
  }
  if (action === RiskDecision.ALLOW) targetUser.balance -= tx.amount;
  tx.status = action;
  tx.reviewedBy = req.user.username;
  tx.reviewedAt = new Date().toISOString();
  tx.balanceDeducted = action === RiskDecision.ALLOW;
  tx.auditDetail = comment || 'Admin 终审完成';
  tx.reason = `Admin 终审：${action}。${tx.auditDetail}`;
  db.save();
  res.json(createResponse(true, tx, `交易终审已处理为 ${action}。`));
});

/**
 * 5. Growth Analyst Dashboard
 */
app.get('/api/growth/metrics', authMiddleware, async (req: any, res) => {
  const user = req.user;
  if (user.role !== UserRole.GROWTH_ANALYST) {
    return res.status(403).json(createResponse(false, null, '仅 Growth Analyst 或 Admin 可以查看增长经营分析数据。'));
  }

  // Constraint: Growth analyst must have passed KYC to see growth metrics details
  if (user.role === UserRole.GROWTH_ANALYST) {
    const kyc = db.getKycProfiles.find(p => p.userId === user.id);
    if (!getKycTradingAccess(kyc).active) {
      return res.status(403).json(createResponse(false, null, '权限审查不足：您当前的【增长分析师】账户尚未通过实名 KYC 认证。证券展业制度规定，未过实名合规校验的人员，无权访问及核算平台用户交易与增长漏斗量。请联系最高审计官通过您的 KYC 申请。'));
    }
  }

  const allUsers = db.getUsers;
  const allKyc = db.getKycProfiles;
  const allTxs = db.getTransactions;
  const pct = (part: number, total: number) => `${Math.min(100, total > 0 ? (part / total) * 100 : 0).toFixed(1)}%`;
  const funnelCounts = [
    { stage: '访问用户', value: 1200 },
    { stage: '注册用户', value: 155 },
    { stage: '开始 KYC', value: 132 },
    { stage: '提交 KYC', value: 108 },
    { stage: 'KYC 通过', value: 84 },
    { stage: '首次入金', value: 67 },
    { stage: '首次交易', value: 45 },
    { stage: '活跃交易者', value: 32 },
    { stage: '留存交易者', value: 24 }
  ];
  const funnelData = funnelCounts.map((item, index) => {
    const previous = index === 0 ? item.value : funnelCounts[index - 1].value;
    return {
      ...item,
      previousRate: index === 0 ? '100.0%' : pct(item.value, previous),
      visitRate: pct(item.value, funnelCounts[0].value),
      dropOff: index === 0 ? 0 : Math.max(0, previous - item.value)
    };
  });

  const allowedTxs = allTxs.filter(t => t.status === RiskDecision.ALLOW);
  const realGmv = allowedTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const totalGmv = realGmv + 1485000;
  const conversionMetrics = {
    dau: 53,
    wau: 126,
    mau: 248,
    newRegistrations: 18,
    registerConversionRate: pct(155, 1200),
    kycSubmissionRate: pct(108, 132),
    kycApprovalRate: pct(84, 108),
    firstDepositRate: pct(67, 84),
    firstTradeRate: pct(45, 67),
    activeTraders: 32,
    totalGmv,
    arpu: Math.round(totalGmv / 45)
  };

  const opportunitySegments = [
    { name: '注册未 KYC', count: 23, description: '已注册但尚未开始实名认证。', action: '推送 KYC 引导和认证材料说明。' },
    { name: 'KYC 开始未提交', count: 24, description: '已进入认证流程但尚未提交资料。', action: '提醒保存进度并补充缺失材料。' },
    { name: 'KYC 提交待审核', count: 16, description: '认证资料已提交，正在等待审核。', action: '关注审核时效并同步预计完成时间。' },
    { name: 'KYC 通过未入金', count: 17, description: '已完成实名认证但尚未充值。', action: '推送首充指引和低风险产品介绍。' },
    { name: '入金未交易', count: 22, description: '已有可用资金但尚未发起首笔交易。', action: '推荐低风险产品并提示新手交易流程。' },
    { name: '首单后沉默', count: 13, description: '完成首笔交易后近期未继续活跃。', action: '推送持仓回顾和适配产品提醒。' },
    { name: '高价值活跃用户', count: 9, description: '交易活跃且累计贡献较高。', action: '提供专属产品组合和客户关怀。' },
    { name: 'KYC 即将到期用户', count: 6, description: '证件将在 30 天内到期。', action: '提前提醒更新证件，避免交易中断。' }
  ];

  const rejectedKyc = allKyc.filter(k => k.status === KYCStatus.REJECTED).length;
  const manualKyc = allKyc.filter(k => k.status === KYCStatus.MANUAL_REVIEW).length;
  const expiredKyc = allKyc.filter(k => isKycExpired(k)).length;
  const expiringKyc = allKyc.filter(k => {
    if (!k.idDocumentExpiresAt || isKycExpired(k)) return false;
    const days = (new Date(`${k.idDocumentExpiresAt}T23:59:59`).getTime() - Date.now()) / 86400000;
    return days <= 30;
  }).length;
  const kycAnalysis = {
    started: 132,
    submitted: 108,
    approved: 84,
    rejected: Math.max(8, rejectedKyc),
    manualReview: Math.max(16, manualKyc),
    averageReviewHours: 7.4,
    approvalRate: pct(84, 108),
    rejectionRate: pct(Math.max(8, rejectedKyc), 108),
    expiringSoon: Math.max(6, expiringKyc),
    expired: expiredKyc
  };

  const productBlocks = allTxs.filter(t => t.status === RiskDecision.BLOCK && /产品|适当性|product/i.test(t.reason)).length;
  const kycBlocks = allTxs.filter(t => t.status === RiskDecision.BLOCK && /KYC|认证/i.test(t.reason)).length;
  const reviewCount = allTxs.filter(t => t.status === RiskDecision.REVIEW).length;
  const stepUpCount = allTxs.filter(t => t.status === RiskDecision.STEP_UP).length;
  const manualReviewCount = allTxs.filter(t => t.status === RiskDecision.MANUAL_REVIEW).length;
  const riskFriction = {
    productSuitabilityBlocks: productBlocks,
    kycBlocks,
    reviewCount,
    stepUpCount,
    manualReviewCount,
    averageManualHandlingHours: 3.8,
    reviewApprovalRate: '72.0%',
    stepUpApprovalRate: '81.0%',
    postBlockChurnRate: '18.4%'
  };

  const productAnalytics = db.getProducts.map((product, index) => {
    const applications = allTxs.filter(t => t.assetType === product.name || t.assetType.includes(product.name) || product.name.includes(t.assetType));
    const approved = applications.filter(t => t.status === RiskDecision.ALLOW);
    const blocked = applications.filter(t => t.status === RiskDecision.BLOCK);
    const exposure = 420 - index * 38;
    const clicks = Math.max(applications.length, 126 - index * 13);
    return {
      product: product.name,
      exposure,
      clicks,
      applications: Math.max(applications.length, 36 - index * 4),
      approved: Math.max(approved.length, 24 - index * 3),
      blocked: Math.max(blocked.length, index + 2),
      gmv: approved.reduce((sum, tx) => sum + tx.amount, 0) + Math.max(25000, 180000 - index * 22000),
      clickRate: pct(clicks, exposure),
      applicationRate: pct(Math.max(applications.length, 36 - index * 4), clicks),
      approvalRate: pct(Math.max(approved.length, 24 - index * 3), Math.max(applications.length, 36 - index * 4))
    };
  });

  const channelAnalytics = [
    { channel: '自然流量', visit: 430, register: 61, kycApproved: 35, firstDeposit: 28, firstTrade: 20, gmv: 485000 },
    { channel: '付费广告', visit: 310, register: 38, kycApproved: 18, firstDeposit: 13, firstTrade: 8, gmv: 236000 },
    { channel: '用户推荐', visit: 190, register: 29, kycApproved: 18, firstDeposit: 15, firstTrade: 11, gmv: 398000 },
    { channel: '合作伙伴', visit: 165, register: 18, kycApproved: 9, firstDeposit: 7, firstTrade: 4, gmv: 251000 },
    { channel: '营销活动', visit: 105, register: 9, kycApproved: 4, firstDeposit: 4, firstTrade: 2, gmv: 115000 }
  ].map(item => ({
    ...item,
    registerRate: pct(item.register, item.visit),
    firstTradeRate: pct(item.firstTrade, item.firstDeposit)
  }));

  const overviewSummary = {
    largestDrop: '访问用户 → 注册用户（流失 1,045 人）',
    highestValueChannel: '自然流量（GMV ¥485,000）',
    highestGmvProduct: productAnalytics.slice().sort((a, b) => b.gmv - a.gmv)[0]?.product || '-',
    aiConclusion: '注册转化是最大绝对流失点；KYC 提交到通过是最大合规摩擦点；应优先激活 KYC 通过未入金与入金未交易人群。'
  };

  const segmentDetails = Object.fromEntries(opportunitySegments.map((segment, segmentIndex) => [
    segment.name,
    Array.from({ length: Math.min(segment.count, 6) }, (_, index) => {
      const trader = allUsers.filter(u => u.role === UserRole.TRADER)[index % Math.max(1, allUsers.filter(u => u.role === UserRole.TRADER).length)];
      const profile = allKyc.find(k => k.userId === trader?.id);
      const depositAmount = trader?.firstDepositAt ? Math.max(1000, trader.balance) : 0;
      return {
        username: `用户${String(segmentIndex + 1).padStart(2, '0')}${String(index + 1).padStart(2, '0')}`,
        registeredAt: trader?.createdAt || new Date(Date.now() - (index + 3) * 86400000).toISOString(),
        kycStatus: profile?.status || (segment.name.includes('KYC') ? KYCStatus.PENDING : KYCStatus.INIT),
        depositAmount,
        lastActiveAt: trader?.lastActiveAt || new Date(Date.now() - (index + 1) * 86400000).toISOString(),
        channel: channelAnalytics[(segmentIndex + index) % channelAnalytics.length].channel,
        suggestedAction: segment.action
      };
    })
  ]));

  const copilotReport = await AIService.generateGrowthSummary({
    conversionMetrics,
    funnelData,
    opportunitySegments,
    kycAnalysis,
    riskFriction
  });

  return res.json(createResponse(true, {
    dataMode: '演示经营数据与当前数据库聚合数据',
    funnelData,
    conversionMetrics,
    opportunitySegments,
    kycAnalysis,
    riskFriction,
    productAnalytics,
    channelAnalytics,
    overviewSummary,
    segmentDetails,
    copilotReport
  }));
});

/**
 * 6. Wealth advisory (Personalised Recommended Products matching user risk limit level)
 */
app.get('/api/products', authMiddleware, async (req: any, res) => {
  const user = req.user;
  if (user.role !== UserRole.TRADER) {
    return res.status(403).json(createResponse(false, null, '仅 Trader 可以查看投资推荐。'));
  }
  
  // Fetch risk level of target user
  const scorecard = db.getRiskScores.find(s => s.userId === user.id);
  const profile = db.getKycProfiles.find(p => p.userId === user.id);
  const effectiveRisk = getEffectiveRiskResult(profile, scorecard);
  const userRiskLevel = effectiveRisk ? effectiveRisk.level : scorecard ? scorecard.level : RiskLevel.MEDIUM;
  const userRiskScore = effectiveRisk ? effectiveRisk.score : scorecard ? scorecard.score : 50;

  // Filter recommendations matching the transaction suitability rule:
  // score 20-49 => LOW only; 50-79 => LOW/MEDIUM; 80+ => all products.
  const allProducts = db.getProducts;
  
  const recommended = await Promise.all(
    allProducts.map(async (prod) => {
      const eligibility = isProductEligibleForScore(userRiskScore, prod.riskLevel);

      // Ask AI Wealth Advisor to generate highly unique matching rationale 
      const matchingAdvisory = await AIService.explainProductRecommendation({
        username: user.username,
        productName: prod.name,
        riskScore: userRiskScore,
        riskLevel: userRiskLevel,
        expectedReturn: prod.expectedReturn
      });

      return {
        ...prod,
        eligible: eligibility,
        explanation: matchingAdvisory,
        // Propose matched percentage score 
        matchingScore: eligibility 
          ? Math.round(98 - Math.abs(userRiskScore - (prod.riskLevel === 'LOW' ? 85 : prod.riskLevel === 'MEDIUM' ? 60 : 35))) 
          : 0
      };
    })
  );

  return res.json(createResponse(true, recommended));
});

/**
 * 7. Audit Logging Explorer
 */
app.get('/api/audit/logs', authMiddleware, (req: any, res) => {
  const user = req.user;
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.RISK_ANALYST) {
    return res.status(403).json(createResponse(false, null, '权限审查不足：仅支持管理员或风险控制组调取全链路审计流'));
  }
  if (user.role === UserRole.ADMIN) {
    return res.json(createResponse(true, db.getBehaviorLogs));
  }

  const traderIds = new Set(db.getUsers.filter(u => u.role === UserRole.TRADER).map(u => u.id));
  const traderLogs = db.getBehaviorLogs.filter(log => traderIds.has(log.userId));
  return res.json(createResponse(true, traderLogs));
});

/**
 * 8. AI Provider Configurations Checking and Hot Switching
 */
app.get('/api/ai/config', authMiddleware, (req: any, res) => {
  if (req.user.role !== UserRole.ADMIN) {
    return res.status(403).json(createResponse(false, null, '仅 Admin 可以查看大模型配置'));
  }
  res.json(createResponse(true, {
    provider: process.env.AI_PROVIDER || 'mock',
    ollama_url: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    gemini_key_active: !!process.env.GEMINI_API_KEY,
    gemini_api_key_masked: process.env.GEMINI_API_KEY ? '****' + process.env.GEMINI_API_KEY.slice(-4) : ''
  }));
});

app.post('/api/ai/config', authMiddleware, (req: any, res) => {
  const user = req.user;
  if (user.role !== UserRole.ADMIN) {
    return res.status(403).json(createResponse(false, null, '权限不足：仅主系统管理员能调整大语言模型参数配置'));
  }
  const { provider, ollama_url, gemini_api_key } = req.body;
  
  if (provider && ['mock', 'ollama', 'gemini'].includes(provider)) process.env.AI_PROVIDER = provider;
  if (ollama_url) process.env.OLLAMA_BASE_URL = ollama_url;
  if (gemini_api_key && !String(gemini_api_key).includes('*')) process.env.GEMINI_API_KEY = gemini_api_key;

  return res.json(createResponse(true, {
    provider: process.env.AI_PROVIDER,
    ollama_url: process.env.OLLAMA_BASE_URL,
    gemini_key_active: !!process.env.GEMINI_API_KEY,
    gemini_api_key_masked: process.env.GEMINI_API_KEY ? '****' + process.env.GEMINI_API_KEY.slice(-4) : ''
  }, '大模型核心引擎参数配置动态生效完成'));
});

/**
 * =====================================
 * INTEGRATED VITE & SINGLE PAGE WEB ROUTING MIDDLEWARES
 * =====================================
 */

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Development Middlewaremode mounting
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Running development environment. Vite middleware mounted.');
  } else {
    // Production serving compiled client SPA files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Running production release. Static dist assets mounted.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RiskMind AI Node backend running on Port ${PORT}`);
  });
}

startServer();
