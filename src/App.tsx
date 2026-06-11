
import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Copy,
  CreditCard,
  Database,
  DollarSign,
  Download,
  FileCheck,
  FlaskConical,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  SlidersHorizontal,
  Terminal,
  UserCheck,
  UserCog,
  Users,
  XCircle
} from 'lucide-react';
import {
  BehaviorLog,
  DepositRecord,
  InvestmentProduct,
  KYCProfile,
  KYCStatus,
  RiskDecision,
  RiskLevel,
  RiskScore,
  Transaction,
  User,
  UserRole
} from './types';

type Tab = 'dashboard' | 'kyc' | 'accountKyc' | 'risk' | 'transactions' | 'products' | 'wallet' | 'auditLogs' | 'adminUsers' | 'adminKyc' | 'adminTransactions' | 'adminAi' | 'adminSystem' | 'adminDemo' | 'growthOverview' | 'growthFunnel' | 'growthSegments' | 'growthExperiments';

type TradeModal = {
  open: boolean;
  product: any | null;
  amount: string;
  submitting: boolean;
  result: any | null;
  error: string;
};

type GrowthExperiment = {
  id: string;
  name: string;
  segment: string;
  metric: string;
  status: string;
  startDate: string;
  result: string;
  hypothesis: string;
  groupA: string;
  groupB: string;
  duration: string;
  successCriteria: string;
};

const rolePresets: Record<string, { username: string; password: string }> = {
  trader: { username: 'trader', password: 'trader123' },
  risk: { username: 'risk', password: 'risk123' },
  growth: { username: 'growth', password: 'growth123' },
  admin: { username: 'admin', password: 'admin123' }
};

const money = (v = 0) => `¥${Number(v || 0).toLocaleString()}`;
const localDateKey = (value: string) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const normalizeDateOnly = (value = '') => {
  const normalized = String(value).trim().replace(/[/.]/g, '-');
  const parts = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!parts) return normalized;
  return `${parts[1]}-${parts[2].padStart(2, '0')}-${parts[3].padStart(2, '0')}`;
};
const cnRisk = (risk?: string) => risk === 'LOW' ? '低风险' : risk === 'MEDIUM' ? '中风险' : risk === 'HIGH' ? '高风险' : '未标注';
const cnKyc = (s?: KYCStatus) => s === KYCStatus.VERIFIED ? '已认证' : s === KYCStatus.PENDING ? '审核中' : s === KYCStatus.REJECTED ? '未通过' : s === KYCStatus.MANUAL_REVIEW ? '需要人工核验' : '未提交';
const hasRetainedKycAccess = (profile?: KYCProfile | null) => profile?.status !== KYCStatus.VERIFIED && profile?.tradingAccessActive === true;
const hasActiveKycAccess = (profile?: KYCProfile | null) => profile?.tradingAccessActive === true;
const shouldShowKycNav = (profile?: KYCProfile | null) => !hasActiveKycAccess(profile);
const isExpiredKyc = (profile?: KYCProfile | null) => !!profile?.idDocumentExpiresAt
  && new Date(`${profile.idDocumentExpiresAt}T23:59:59`).getTime() < Date.now();
const adminKycStatusText = (profile: KYCProfile) => profile.status === KYCStatus.VERIFIED && isExpiredKyc(profile)
  ? '已通过 / 证件已过期'
  : cnKyc(profile.status);
const traderAccountStatusText = (profile?: KYCProfile | null) => {
  if (hasActiveKycAccess(profile)) return `已认证（有效期至 ${profile?.tradingAccessExpiresAt || profile?.idDocumentExpiresAt || '-'}）`;
  if (profile?.status === KYCStatus.VERIFIED) return '认证已过期，暂不可交易';
  return `${cnKyc(profile?.status)}，暂不可交易`;
};
const staffKycStatusText = (profile?: KYCProfile | null) => {
  if (hasActiveKycAccess(profile)) return `已认证（有效期至 ${profile?.tradingAccessExpiresAt || profile?.idDocumentExpiresAt || '-'}）`;
  if (profile?.status === KYCStatus.VERIFIED) return '认证已过期';
  return cnKyc(profile?.status);
};
const accountKycResult = (profile?: KYCProfile | null) => hasActiveKycAccess(profile) ? KYCStatus.VERIFIED : profile?.status || KYCStatus.INIT;
const accountKycOptionText = (profile: any) => {
  const result = accountKycResult(profile);
  const reviewNote = result === KYCStatus.VERIFIED && profile.status !== KYCStatus.VERIFIED
    ? `（资料更新${cnKyc(profile.status)}）`
    : '';
  return `${profile.username} / ${profile.role} / 账号认证 ${result}${reviewNote}`;
};
const roleWorkspaceLabel = (role?: UserRole) => role === UserRole.TRADER
  ? 'Trader 交易与投资中心'
  : role === UserRole.RISK_ANALYST
    ? 'Risk 风控分析工作台'
    : role === UserRole.GROWTH_ANALYST
      ? 'Growth 增长分析中心'
      : role === UserRole.ADMIN
        ? 'Admin 系统管理中心'
        : '智能风控决策平台';
const defaultTabForRole = (role?: UserRole): Tab => role === UserRole.GROWTH_ANALYST ? 'growthOverview' : 'dashboard';
const txStatusText = (s?: RiskDecision) => s === RiskDecision.ALLOW ? '已通过' : s === RiskDecision.BLOCK ? '未通过' : s === RiskDecision.STEP_UP ? '待进一步确认' : s === RiskDecision.REVIEW || s === RiskDecision.MANUAL_REVIEW ? '审核中' : '处理中';
const txDetailText = (s?: RiskDecision) => {
  switch (s) {
    case RiskDecision.ALLOW: return '本次交易已通过系统审核，金额已从账户余额中扣减。';
    case RiskDecision.BLOCK: return '本次交易暂不符合当前账户的交易准入条件。';
    case RiskDecision.REVIEW: return '本次交易需要进一步确认，已进入审核流程。审核完成前不会扣减余额。';
    case RiskDecision.MANUAL_REVIEW: return '为了保障账户安全，本次交易需要人工复核。审核完成后状态会更新。';
    case RiskDecision.STEP_UP: return '为了保障账户安全，本次交易需要进一步验证或人工确认。请关注处理进度。';
    default: return '系统正在处理本次交易申请。';
  }
};
const tradeResultText = (s?: RiskDecision) => {
  switch (s) {
    case RiskDecision.ALLOW: return { title: '交易已提交并通过', desc: '本次交易已通过系统审核，金额已从账户余额中扣减。' };
    case RiskDecision.BLOCK: return { title: '交易暂无法完成', desc: '本次交易不符合当前账户的交易准入条件。你可以选择其他产品或稍后再试。' };
    case RiskDecision.REVIEW: return { title: '交易已提交审核', desc: '本次交易需要进一步确认，已进入审核流程。审核完成前不会扣减余额。' };
    case RiskDecision.MANUAL_REVIEW: return { title: '交易已提交审核', desc: '为了保障账户安全，本次交易需要人工复核。审核完成后状态会更新。' };
    case RiskDecision.STEP_UP: return { title: '交易需要进一步确认', desc: '为了保障账户安全，本次交易需要进一步验证或人工确认。请在交易记录中查看处理进度。' };
    default: return { title: '交易处理中', desc: '系统正在处理本次交易申请。' };
  }
};
const sanitizeReason = (reason = '', status?: RiskDecision) => {
  const text = reason.toLowerCase();
  if (/blacklist|黑名单/.test(text)) return '账户状态暂不满足交易准入条件';
  if (/frequency|频次|1分钟|5次/.test(text)) return '近期交易活动较频繁，需要进一步审核';
  if (/amount|avg|3倍|historical|金额/.test(text)) return '本次交易金额需要进一步确认';
  if (/score|risk score|分数|评分/.test(text)) return '当前账户暂不满足该产品的交易准入条件';
  if (/product risk|产品风险|适当性/.test(text)) return '该产品暂不符合当前账户的交易准入条件';
  if (status === RiskDecision.ALLOW) return '交易已通过';
  if (status === RiskDecision.BLOCK) return '本次交易暂无法完成';
  if (status === RiskDecision.STEP_UP) return '本次交易需要进一步确认';
  return '本次交易正在审核中';
};

function scorePreview(input: { kycStatus: KYCStatus; ipChanges: number; deviceSwitches: number; txFrequency: number; blacklistHit: boolean }) {
  const woeKyc = input.kycStatus === KYCStatus.VERIFIED ? 0.8 : -1.2;
  const woeIp = input.ipChanges === 0 ? 0.6 : input.ipChanges <= 2 ? 0.1 : -0.8;
  const woeDevice = input.deviceSwitches === 0 ? 0.5 : input.deviceSwitches === 1 ? 0.1 : -0.9;
  const woeTx = input.txFrequency < 5 ? 0.4 : input.txFrequency <= 15 ? 0 : -1;
  const woeBlacklist = input.blacklistHit ? -3 : 0.7;
  const sum = woeKyc + woeIp + woeDevice + woeTx + woeBlacklist;
  const pd = 1 / (1 + Math.exp(sum));
  const score = Math.max(0, Math.min(100, Math.round(55 + 10 * sum)));
  const level = score >= 80 ? RiskLevel.LOW : score >= 50 ? RiskLevel.MEDIUM : score >= 20 ? RiskLevel.HIGH : RiskLevel.CRITICAL;
  const decision = score >= 80 ? RiskDecision.ALLOW : score >= 50 ? RiskDecision.REVIEW : score >= 20 ? RiskDecision.MANUAL_REVIEW : RiskDecision.BLOCK;
  const breakdown = `【WOE评分卡拆解】\nKYC: ${input.kycStatus} / WOE ${woeKyc.toFixed(2)}\nIP 归属跃迁: ${input.ipChanges} 次 / WOE ${woeIp.toFixed(2)}\n设备切换: ${input.deviceSwitches} 次 / WOE ${woeDevice.toFixed(2)}\n1分钟交易频率: ${input.txFrequency} 次 / WOE ${woeTx.toFixed(2)}\n黑名单命中: ${input.blacklistHit ? '是' : '否'} / WOE ${woeBlacklist.toFixed(2)}\nSum WOE: ${sum.toFixed(2)}\nScore: ${score}\nPD: ${(pd * 100).toFixed(2)}%\nDecision: ${decision}`;
  return { score, pd, level, decision, breakdown };
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('riskmind_token') || '');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loginUsername, setLoginUsername] = useState('trader');
  const [loginPassword, setLoginPassword] = useState('trader123');
  const [authError, setAuthError] = useState('');

  const [kycList, setKycList] = useState<any[]>([]);
  const [kycProfile, setKycProfile] = useState<KYCProfile | null>(null);
  const [riskScores, setRiskScores] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [logs, setLogs] = useState<BehaviorLog[]>([]);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [aiConfig, setAiConfig] = useState<any>({ provider: 'mock', ollama_url: '', gemini_key_active: false });
  const [adminOverview, setAdminOverview] = useState<any>({});
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminTransactions, setAdminTransactions] = useState<Transaction[]>([]);
  const [systemConfig, setSystemConfig] = useState<any>({});
  const [adminUserFilters, setAdminUserFilters] = useState({ role: '', kycStatus: '', accountStatus: '' });
  const [adminKycFilters, setAdminKycFilters] = useState({ role: '', status: '' });
  const [selectedAdminUser, setSelectedAdminUser] = useState<any | null>(null);
  const [selectedAdminKyc, setSelectedAdminKyc] = useState<any | null>(null);
  const [pendingKycAction, setPendingKycAction] = useState<{ profile: any; status: KYCStatus; label: string; reasonRequired: boolean } | null>(null);
  const [kycActionReason, setKycActionReason] = useState('');
  const [selectedAdminTransaction, setSelectedAdminTransaction] = useState<Transaction | null>(null);
  const [adminTxStatus, setAdminTxStatus] = useState('');
  const [aiForm, setAiForm] = useState({ provider: 'mock', ollama_url: '', gemini_api_key: '' });
  const [growthMetrics, setGrowthMetrics] = useState<any | null>(null);
  const [growthError, setGrowthError] = useState('');
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [kycForm, setKycForm] = useState({ name: '张伟', idNumber: '110101199003072345', dob: '1990-03-07', nationality: 'China', idType: '身份证', idDocumentExpiresAt: '2030-03-07', deviceInfo: 'Browser', ipAddress: '127.0.0.1' });
  const [simParams, setSimParams] = useState({ userId: '', ipChanges: 0, deviceSwitches: 0, txFrequency: 3, blacklistHit: false });
  const [savingScore, setSavingScore] = useState(false);
  const [auditComment, setAuditComment] = useState('');
  const [selectedKycAuditId, setSelectedKycAuditId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [tradeModal, setTradeModal] = useState<TradeModal>({ open: false, product: null, amount: '', submitting: false, result: null, error: '' });
  const [txAuditComment, setTxAuditComment] = useState('');
  const [txFilters, setTxFilters] = useState({ trader: '', status: '', keyword: '', dateFrom: '', dateTo: '' });
  const [logFilters, setLogFilters] = useState({ role: '', user: '', action: '', service: '', riskFlag: '', keyword: '', dateFrom: '', dateTo: '' });
  const [growthOverviewTab, setGrowthOverviewTab] = useState<'channels' | 'products'>('channels');
  const [growthExperimentTab, setGrowthExperimentTab] = useState<'experiments' | 'ai'>('experiments');
  const [selectedGrowthSegment, setSelectedGrowthSegment] = useState<any | null>(null);
  const [selectedGrowthExperiment, setSelectedGrowthExperiment] = useState<GrowthExperiment | null>(null);
  const [showExperimentForm, setShowExperimentForm] = useState(false);
  const [touchCopy, setTouchCopy] = useState('');
  const [growthExperiments, setGrowthExperiments] = useState<GrowthExperiment[]>([
    { id: 'exp_1', name: '注册页 CTA 优化', segment: '访问未注册用户', metric: '注册转化率', status: '运行中', startDate: '2026-06-01', result: '实验组 +8.4%', hypothesis: '突出新手价值可提高注册意愿', groupA: '当前注册页', groupB: '强化价值说明与主 CTA', duration: '14 天', successCriteria: '注册转化率提升 5%' },
    { id: 'exp_2', name: 'KYC 进度条与草稿保存', segment: 'KYC 开始未提交', metric: 'KYC 提交率', status: '运行中', startDate: '2026-06-04', result: '实验组 +11.2%', hypothesis: '减少填写焦虑可降低中途退出', groupA: '当前 KYC 表单', groupB: '进度条、草稿保存、材料提示', duration: '21 天', successCriteria: 'KYC 提交率提升 8%' },
    { id: 'exp_3', name: '首充引导实验', segment: 'KYC 通过未入金', metric: '首充转化率', status: '待启动', startDate: '2026-06-15', result: '尚未开始', hypothesis: '分步首充指引可提高首次入金', groupA: '通用提醒', groupB: '分步指引与 FAQ', duration: '14 天', successCriteria: '首充转化率提升 6%' },
    { id: 'exp_4', name: '低风险产品推荐实验', segment: '入金未交易', metric: '首单转化率', status: '已完成', startDate: '2026-05-15', result: '实验组 +9.1%', hypothesis: '低风险产品可降低首单决策门槛', groupA: '默认产品排序', groupB: '优先展示低风险产品', duration: '21 天', successCriteria: '首单转化率提升 7%' }
  ]);
  const [experimentForm, setExperimentForm] = useState({ name: '', segment: '', metric: '', hypothesis: '', groupA: '', groupB: '', duration: '', successCriteria: '' });

  const api = async (path: string, options: RequestInit = {}) => {
    const res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error: any = new Error(body.message || `请求失败 ${res.status}`);
      error.data = body.data;
      error.status = res.status;
      throw error;
    }
    return body;
  };

  const refresh = async () => {
    if (!token) return;
    const me = await api('/api/auth/me').catch(() => null);
    if (!me?.success) return;
    setCurrentUser(me.data);
    const [kyc, scores, txs, prod] = await Promise.all([
      api('/api/kyc/list').catch(() => ({ data: [] })),
      api('/api/risk/list').catch(() => ({ data: [] })),
      api('/api/transactions/list').catch(() => ({ data: [] })),
      api('/api/products').catch(() => ({ data: [] }))
    ]);
    setKycList(kyc.data || []);
    setKycProfile((kyc.data || []).find((p: any) => p.userId === me.data.id) || null);
    setRiskScores(scores.data || []);
    setTransactions(txs.data || []);
    setProducts(prod.data || []);
    if ([UserRole.ADMIN, UserRole.RISK_ANALYST].includes(me.data.role)) {
      const audit = await api('/api/audit/logs').catch(() => ({ data: [] }));
      setLogs(audit.data || []);
    }
    if (me.data.role === UserRole.ADMIN) {
      const [cfg, overview, users, adminTx, sysConfig] = await Promise.all([
        api('/api/ai/config').catch(() => ({ data: aiConfig })),
        api('/api/admin/overview').catch(() => ({ data: {} })),
        api('/api/admin/users').catch(() => ({ data: [] })),
        api('/api/admin/transactions').catch(() => ({ data: [] })),
        api('/api/admin/system-config').catch(() => ({ data: {} }))
      ]);
      setAiConfig(cfg.data || aiConfig);
      setAiForm({ provider: cfg.data?.provider || 'mock', ollama_url: cfg.data?.ollama_url || '', gemini_api_key: cfg.data?.gemini_api_key_masked || '' });
      setAdminOverview(overview.data || {});
      setAdminUsers(users.data || []);
      setAdminTransactions(adminTx.data || []);
      setSystemConfig(sysConfig.data || {});
    }
    if (me.data.role === UserRole.TRADER) {
      const dep = await api('/api/auth/deposits').catch(() => ({ data: [] }));
      setDeposits(dep.data || []);
    }
    if (me.data.role === UserRole.GROWTH_ANALYST) {
      setGrowthError('');
      try {
        const growth = await api('/api/growth/metrics');
        setGrowthMetrics(growth.data || null);
      } catch (e: any) {
        setGrowthMetrics(null);
        setGrowthError(e.message || '增长数据加载失败');
      }
    }
  };

  useEffect(() => { if (token) refresh(); }, [token]);
  useEffect(() => {
    if (currentUser?.role === UserRole.GROWTH_ANALYST && !['growthOverview', 'growthFunnel', 'growthSegments', 'growthExperiments', 'accountKyc'].includes(activeTab)) {
      setActiveTab('growthOverview');
    }
    if (currentUser?.role !== UserRole.RISK_ANALYST && activeTab === 'risk') {
      setActiveTab(defaultTabForRole(currentUser?.role as UserRole));
    }
    if (![UserRole.RISK_ANALYST, UserRole.TRADER].includes(currentUser?.role as UserRole) && activeTab === 'transactions') {
      setActiveTab(defaultTabForRole(currentUser?.role as UserRole));
    }
    if (activeTab.startsWith('admin') && currentUser?.role !== UserRole.ADMIN) {
      setActiveTab(defaultTabForRole(currentUser?.role as UserRole));
    }
  }, [currentUser?.role, activeTab]);
  useEffect(() => {
    if (currentUser?.role === UserRole.RISK_ANALYST && !simParams.userId) {
      const firstTrader = kycList.find(k => k.role === UserRole.TRADER);
      if (firstTrader) selectRiskUser(firstTrader.userId);
    }
  }, [currentUser?.role, kycList.length, riskScores.length]);

  const login = async (e?: React.FormEvent) => {
    e?.preventDefault(); setAuthError('');
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loginUsername, password: loginPassword }) });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || '登录失败');
      localStorage.setItem('riskmind_token', body.data.token);
      setToken(body.data.token); setCurrentUser(body.data.user); setActiveTab(defaultTabForRole(body.data.user.role));
    } catch (e: any) { setAuthError(e.message); }
  };
  const quickLogin = async (key: string) => {
    const preset = rolePresets[key];
    setLoginUsername(preset.username);
    setLoginPassword(preset.password);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset)
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || '角色切换失败');
      localStorage.setItem('riskmind_token', body.data.token);
      setToken(body.data.token);
      setCurrentUser(body.data.user);
      setActiveTab(defaultTabForRole(body.data.user.role));
    } catch (e: any) {
      setAuthError(e.message || '角色切换失败');
    }
  };
  const logout = () => {
    localStorage.removeItem('riskmind_token');
    setToken('');
    setCurrentUser(null);
    setActiveTab('dashboard');
    setActionNotice(null);
    setTradeModal({ open: false, product: null, amount: '', submitting: false, result: null, error: '' });
  };

  const myScore = riskScores.find(s => s.userId === currentUser?.id);
  const selectedSimKyc = kycList.find(k => k.userId === simParams.userId);
  const preview = simParams.userId ? scorePreview({ ...simParams, kycStatus: accountKycResult(selectedSimKyc) }) : null;
  const traderIds = new Set(kycList.filter(k => k.role === UserRole.TRADER).map(k => k.userId));
  const pendingTx = transactions.filter(t => [RiskDecision.REVIEW, RiskDecision.MANUAL_REVIEW, RiskDecision.STEP_UP].includes(t.status));
  const today = new Date().toDateString();
  const todayTx = transactions.filter(t => new Date(t.createdAt).toDateString() === today);
  const visibleKycList = kycList.filter(k => currentUser?.role !== UserRole.RISK_ANALYST || k.role === UserRole.TRADER);
  const reviewableKycList = visibleKycList.filter(k => [KYCStatus.PENDING, KYCStatus.MANUAL_REVIEW].includes(k.status));
  const selectedKycAudit = reviewableKycList.find(k => k.id === selectedKycAuditId) || reviewableKycList[0] || null;
  const filteredTransactions = useMemo(() => transactions.filter(tx => {
    const txDate = localDateKey(tx.createdAt);
    const keyword = txFilters.keyword.trim().toLowerCase();
    return (!txFilters.trader || tx.userId === txFilters.trader)
      && (!txFilters.status || tx.status === txFilters.status)
      && (!txFilters.dateFrom || txDate >= txFilters.dateFrom)
      && (!txFilters.dateTo || txDate <= txFilters.dateTo)
      && (!keyword || `${tx.id} ${tx.username || ''} ${tx.assetType} ${tx.reason}`.toLowerCase().includes(keyword));
  }), [transactions, txFilters]);
  const filteredAdminUsers = useMemo(() => adminUsers.filter(user =>
    (!adminUserFilters.role || user.role === adminUserFilters.role)
    && (!adminUserFilters.kycStatus || user.kycStatus === adminUserFilters.kycStatus)
    && (!adminUserFilters.accountStatus || user.accountStatus === adminUserFilters.accountStatus)
  ), [adminUsers, adminUserFilters]);
  const filteredAdminTransactions = useMemo(() =>
    adminTransactions.filter(tx => !adminTxStatus || tx.status === adminTxStatus),
  [adminTransactions, adminTxStatus]);
  const filteredAdminKyc = useMemo(() => kycList.filter(profile =>
    (!adminKycFilters.role || profile.role === adminKycFilters.role)
    && (!adminKycFilters.status || profile.status === adminKycFilters.status)
  ), [kycList, adminKycFilters]);
  const filteredLogs = useMemo(() => logs.filter(log => {
    const keyword = logFilters.keyword.trim().toLowerCase();
    const logDate = localDateKey(log.timestamp);
    const profile = kycList.find(k => k.userId === log.userId || k.username === log.username);
    return (!logFilters.role || profile?.role === logFilters.role)
      && (!logFilters.user || log.username === logFilters.user)
      && (!logFilters.action || log.actionType === logFilters.action)
      && (!logFilters.service || log.serviceName === logFilters.service)
      && (!logFilters.riskFlag || String(log.riskFlag) === logFilters.riskFlag)
      && (!logFilters.dateFrom || logDate >= logFilters.dateFrom)
      && (!logFilters.dateTo || logDate <= logFilters.dateTo)
      && (!keyword || `${log.username || ''} ${log.actionType} ${log.serviceName} ${log.requestPayload} ${log.responseResult}`.toLowerCase().includes(keyword));
  }), [logs, logFilters, kycList]);
  const transactionUsers: Array<{ id: string; username: string }> = Array.from(
    new Map<string, { id: string; username: string }>(
      transactions.map(tx => [tx.userId, { id: tx.userId, username: tx.username || tx.userId }])
    ).values()
  );
  const logUserOptions = currentUser?.role === UserRole.RISK_ANALYST
    ? kycList
        .filter(k => k.role === UserRole.TRADER)
        .map(k => ({ value: k.username, label: k.name || k.username }))
    : kycList
        .filter(k => !logFilters.role || k.role === logFilters.role)
        .map(k => ({ value: k.username, label: k.name ? `${k.name} / ${k.username}` : k.username }));
  const logRoleOptions = Array.from(new Set(kycList.map(k => k.role).filter(Boolean))).sort();
  const logActions = Array.from(new Set(logs.map(log => log.actionType).filter(Boolean))).sort();
  const logServices = Array.from(new Set(logs.map(log => log.serviceName).filter(Boolean))).sort();
  const getLogUserLabel = (log: BehaviorLog) => {
    const profile = kycList.find(k => k.userId === log.userId || k.username === log.username);
    return profile?.name ? `${profile.name} / ${log.username || profile.username}` : log.username || log.userId;
  };
  const getLogUserRole = (log: BehaviorLog) => kycList.find(k => k.userId === log.userId || k.username === log.username)?.role || '-';

  const access = useMemo(() => {
    if (!hasActiveKycAccess(kycProfile)) return { label: '暂未开通交易权限', products: '暂无', levels: [] as string[], unavailable: '请先完成身份认证' };
    const s = Number(myScore?.score ?? 0);
    if (s >= 80 || myScore?.level === RiskLevel.LOW) return { label: '高级交易权限', products: '低风险 / 中风险 / 高风险产品', levels: ['LOW', 'MEDIUM', 'HIGH'], unavailable: '' };
    if (s >= 50 || myScore?.level === RiskLevel.MEDIUM) return { label: '标准交易权限', products: '低风险 / 中风险产品', levels: ['LOW', 'MEDIUM'], unavailable: '高风险产品暂未开放' };
    if (s >= 20 || myScore?.level === RiskLevel.HIGH) return { label: '基础交易权限', products: '低风险产品', levels: ['LOW'], unavailable: '中高风险产品暂未开放' };
    return { label: '暂停交易权限', products: '暂无', levels: [] as string[], unavailable: '当前账户暂不满足交易准入条件' };
  }, [kycProfile?.status, kycProfile?.tradingAccessActive, myScore?.score, myScore?.level]);

  const selectRiskUser = (userId: string) => {
    const saved = riskScores.find(s => s.userId === userId);
    setSimParams({ userId, ipChanges: saved?.ipChanges ?? 0, deviceSwitches: saved?.deviceSwitches ?? 0, txFrequency: saved?.txFrequency ?? 3, blacklistHit: saved?.blacklistHit ?? false });
  };

  const saveScore = async () => {
    if (!simParams.userId) return;
    setSavingScore(true);
    try {
      await api('/api/risk/evaluate', { method: 'POST', body: JSON.stringify(simParams) });
      const currentTab = activeTab; await refresh(); setActiveTab(currentTab);
      setActionNotice({ type: 'success', text: '评分卡参数已保存，并同步影响该 Trader 的产品准入和交易风控判定。' });
    } catch (e: any) { setActionNotice({ type: 'error', text: e.message || '保存失败' }); }
    finally { setSavingScore(false); }
  };

  const submitKyc = async () => {
    const payload = {
      ...kycForm,
      dob: normalizeDateOnly(kycForm.dob),
      idDocumentExpiresAt: normalizeDateOnly(kycForm.idDocumentExpiresAt)
    };
    try { const res = await api('/api/kyc/submit', { method: 'POST', body: JSON.stringify(payload) }); setKycForm(payload); const currentTab = activeTab; await refresh(); setActiveTab(currentTab); setActionNotice({ type: 'success', text: res.message || 'KYC 已提交，当前状态为审核中。' }); }
    catch (e: any) { setActionNotice({ type: 'error', text: e.message }); }
  };
  const openAccountKyc = () => {
    if (kycProfile) {
      setKycForm({
        name: kycProfile.name || '',
        idNumber: kycProfile.idNumber || '',
        dob: kycProfile.dob || '',
        nationality: kycProfile.nationality || '',
        idType: kycProfile.idType || '',
        idDocumentExpiresAt: kycProfile.idDocumentExpiresAt || '',
        deviceInfo: kycProfile.deviceInfo || 'Browser',
        ipAddress: kycProfile.ipAddress || '127.0.0.1'
      });
    }
    setActionNotice(null);
    setActiveTab('accountKyc');
  };
  const auditKyc = async (id: string, status: KYCStatus, commentsOverride?: string) => {
    try { const res = await api('/api/kyc/audit', { method: 'POST', body: JSON.stringify({ kycId: id, status, comments: commentsOverride ?? auditComment ?? '' }) }); setAuditComment(''); const currentTab = activeTab; await refresh(); setActiveTab(currentTab); setActionNotice({ type: 'success', text: res.message || `KYC 状态已更新为 ${status}` }); }
    catch (e: any) { setActionNotice({ type: 'error', text: e.message }); }
  };
  const openKycAction = (profile: any, status: KYCStatus, label: string, reasonRequired: boolean) => {
    setKycActionReason('');
    setPendingKycAction({ profile, status, label, reasonRequired });
  };
  const confirmKycAction = async () => {
    if (!pendingKycAction) return;
    if (pendingKycAction.reasonRequired && !kycActionReason.trim()) {
      setActionNotice({ type: 'error', text: `${pendingKycAction.label}必须填写原因。` });
      return;
    }
    await auditKyc(
      pendingKycAction.profile.id,
      pendingKycAction.status,
      kycActionReason.trim() || '审核资料符合要求'
    );
    setPendingKycAction(null);
    setKycActionReason('');
  };
  const deposit = async () => {
    try { const res = await api('/api/auth/deposit', { method: 'POST', body: JSON.stringify({ amount: depositAmount, currency: 'CNY', paymentMethod: '模拟入金' }) }); setDepositAmount(''); const currentTab = activeTab; await refresh(); setActiveTab(currentTab); setActionNotice({ type: 'success', text: res.message || '充值成功' }); }
    catch (e: any) { setActionNotice({ type: 'error', text: e.message }); }
  };
  const openTrade = (product: any) => setTradeModal({ open: true, product, amount: '', submitting: false, result: null, error: '' });
  const closeTrade = () => setTradeModal({ open: false, product: null, amount: '', submitting: false, result: null, error: '' });
  const submitTrade = async () => {
    const amount = Number(tradeModal.amount);
    if (!amount || amount <= 0) return setTradeModal(p => ({ ...p, error: '请输入大于 0 的交易金额' }));
    setTradeModal(p => ({ ...p, submitting: true, error: '' }));
    try {
      const res = await api('/api/transactions/apply', { method: 'POST', body: JSON.stringify({ amount, assetType: tradeModal.product?.name || tradeModal.product?.assetType }) });
      setTradeModal(p => ({ ...p, submitting: false, result: { ...res.data, productName: tradeModal.product?.name, productRiskLevel: tradeModal.product?.riskLevel } }));
      const currentTab = activeTab; await refresh(); setActiveTab(currentTab);
    } catch (e: any) { setTradeModal(p => ({ ...p, submitting: false, error: e.message || '交易提交失败' })); }
  };
  const confirmStepUp = async () => {
    setTradeModal(p => ({ ...p, submitting: true, error: '' }));
    try {
      const res = await api('/api/transactions/step-up/confirm', { method: 'POST', body: JSON.stringify({ txId: tradeModal.result?.id }) });
      setTradeModal(p => ({ ...p, submitting: false, result: { ...p.result, ...res.data }, error: '' }));
      const currentTab = activeTab; await refresh(); setActiveTab(currentTab);
    } catch (e: any) {
      const currentTab = activeTab; await refresh(); setActiveTab(currentTab);
      setTradeModal(p => ({
        ...p,
        submitting: false,
        result: e.data ? { ...p.result, ...e.data } : p.result,
        error: e.message || '确认失败'
      }));
    }
  };
  const auditTx = async (id: string, action: RiskDecision) => {
    try { const res = await api('/api/transactions/audit', { method: 'POST', body: JSON.stringify({ txId: id, action, comment: txAuditComment || '人工处理完成' }) }); setTxAuditComment(''); const currentTab = activeTab; await refresh(); setActiveTab(currentTab); setActionNotice({ type: 'success', text: res.message || `交易已处理为 ${action}` }); }
    catch (e: any) { setActionNotice({ type: 'error', text: e.message }); }
  };
  const updateAdminUserStatus = async (userId: string, accountStatus: 'ACTIVE' | 'DISABLED') => {
    try {
      const res = await api('/api/admin/users/status', { method: 'POST', body: JSON.stringify({ userId, accountStatus }) });
      await refresh();
      setActionNotice({ type: 'success', text: res.message });
    } catch (e: any) { setActionNotice({ type: 'error', text: e.message }); }
  };
  const adminAuditTransaction = async (txId: string, action: RiskDecision) => {
    try {
      const res = await api('/api/admin/transactions/audit', { method: 'POST', body: JSON.stringify({ txId, action, comment: txAuditComment || 'Admin 终审完成' }) });
      setTxAuditComment('');
      setSelectedAdminTransaction(res.data);
      await refresh();
      setActiveTab('adminTransactions');
      setActionNotice({ type: 'success', text: res.message });
    } catch (e: any) { setActionNotice({ type: 'error', text: e.message }); }
  };
  const saveAiConfig = async () => {
    try {
      const res = await api('/api/ai/config', { method: 'POST', body: JSON.stringify(aiForm) });
      setAiConfig(res.data);
      setActionNotice({ type: 'success', text: 'AI 配置已保存。' });
    } catch (e: any) { setActionNotice({ type: 'error', text: e.message }); }
  };
  const saveSystemConfig = async () => {
    try {
      const res = await api('/api/admin/system-config', { method: 'POST', body: JSON.stringify(systemConfig) });
      setSystemConfig(res.data);
      setActionNotice({ type: 'success', text: res.message });
    } catch (e: any) { setActionNotice({ type: 'error', text: e.message }); }
  };
  const resetDemoData = async (section: string, label: string) => {
    if (!confirm(`确认执行“${label}”？该操作会修改演示数据。`)) return;
    try {
      const res = await api('/api/admin/demo-reset', { method: 'POST', body: JSON.stringify({ section }) });
      await refresh();
      setActiveTab('adminDemo');
      setActionNotice({ type: 'success', text: res.message });
    } catch (e: any) { setActionNotice({ type: 'error', text: e.message }); }
  };
  const createGrowthExperiment = () => {
    if (!experimentForm.name || !experimentForm.segment || !experimentForm.metric) {
      setActionNotice({ type: 'error', text: '请填写实验名称、目标人群和目标指标。' });
      return;
    }
    setGrowthExperiments(items => [{
      id: `exp_${Date.now()}`,
      ...experimentForm,
      status: '待启动',
      startDate: new Date().toISOString().slice(0, 10),
      result: '尚未开始'
    }, ...items]);
    setExperimentForm({ name: '', segment: '', metric: '', hypothesis: '', groupA: '', groupB: '', duration: '', successCriteria: '' });
    setShowExperimentForm(false);
    setActionNotice({ type: 'success', text: 'Mock 增长实验已创建。' });
  };
  const regenerateGrowthInsight = async () => {
    const currentTab = activeTab;
    await refresh();
    setActiveTab(currentTab);
    setActionNotice({ type: 'success', text: 'AI 增长洞察已重新生成。' });
  };
  const copyGrowthReport = async () => {
    await navigator.clipboard.writeText(growthMetrics?.copilotReport || '');
    setActionNotice({ type: 'success', text: 'AI 增长报告已复制。' });
  };
  const exportGrowthReport = () => {
    const blob = new Blob([growthMetrics?.copilotReport || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RiskMind-Growth-Insight-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const generateTouchCopy = () => {
    const segment = growthMetrics?.opportunitySegments?.[0];
    setTouchCopy(`【RiskMind 账户成长提醒】${segment?.description || '你的账户还有关键步骤尚未完成。'} ${segment?.action || '请登录账户查看下一步操作。'}`);
  };

  if (!currentUser) {
    return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <form onSubmit={login} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3"><ShieldAlert className="text-teal-300" /><div><h1 className="text-xl font-black">RiskMind AI</h1><p className="text-xs text-slate-400">金融 AI 风控与交易准入系统</p></div></div>
        <input className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} placeholder="用户名" />
        <input className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="密码" type="password" />
        {authError && <div className="text-xs text-rose-300">{authError}</div>}
        <button id="login-submit" className="w-full bg-teal-600 hover:bg-teal-500 rounded p-2 text-sm font-bold">验证身份登录</button>
        <div className="grid grid-cols-4 gap-2 text-xs">{Object.keys(rolePresets).map(k => <button type="button" key={k} onClick={() => quickLogin(k)} className="bg-slate-800 rounded p-2 hover:bg-slate-700">{k}</button>)}</div>
      </form>
    </div>;
  }

  const nav = currentUser.role === UserRole.TRADER
    ? [{ id: 'dashboard', label: '系统看板', icon: Activity }, { id: 'products', label: '投资推荐', icon: ShoppingBag }, ...(shouldShowKycNav(kycProfile) ? [{ id: 'kyc', label: '实名 KYC 系统', icon: UserCheck }] : [])]
    : currentUser.role === UserRole.RISK_ANALYST
      ? [{ id: 'dashboard', label: '系统看板', icon: Activity }, { id: 'kyc', label: 'KYC 审核中心', icon: UserCheck }, { id: 'risk', label: '评分卡实验室', icon: SlidersHorizontal }, { id: 'transactions', label: '交易风控台', icon: Terminal }, { id: 'auditLogs', label: '风控审计日志', icon: Database }]
      : currentUser.role === UserRole.GROWTH_ANALYST
        ? [{ id: 'growthOverview', label: '增长总览', icon: Activity }, { id: 'growthFunnel', label: '漏斗与摩擦', icon: BarChart3 }, { id: 'growthSegments', label: '机会人群', icon: Users }, { id: 'growthExperiments', label: '实验与 AI 洞察', icon: FlaskConical }]
        : [
            { id: 'dashboard', label: '系统看板', icon: Activity },
            { id: 'adminUsers', label: '用户管理', icon: UserCog },
            { id: 'adminKyc', label: 'KYC 终审中心', icon: UserCheck },
            { id: 'adminTransactions', label: '交易终审中心', icon: FileCheck },
            { id: 'auditLogs', label: '审计日志中心', icon: Database },
            { id: 'adminAi', label: 'AI 配置中心', icon: Bot },
            { id: 'adminSystem', label: '系统配置', icon: Settings },
            { id: 'adminDemo', label: '演示数据控制台', icon: RotateCcw }
          ];

  return <div className="min-h-screen bg-slate-950 text-slate-100 flex">
    <aside className="sticky top-0 h-screen w-72 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden">
      <div className="p-5 border-b border-slate-800 flex items-center gap-3"><ShieldAlert className="text-teal-300" /><div><div className="font-black">RiskMind AI</div><div className="text-[10px] text-slate-400">{roleWorkspaceLabel(currentUser.role)}</div></div></div>
      <div className="p-4 border-b border-slate-800"><div className="text-sm font-bold">{currentUser.username}</div><div className="text-xs text-teal-300">{currentUser.role}</div></div>
      <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">{nav.map((n: any) => { const Icon = n.icon; return <button key={n.id} onClick={() => { setActiveTab(n.id); setActionNotice(null); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${activeTab === n.id ? 'bg-teal-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Icon className="w-4 h-4" />{n.label}</button>; })}</nav>
      <div className="shrink-0 border-t border-slate-800 bg-slate-950/50 p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">角色切换</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.keys(rolePresets).map(k => <button key={k} onClick={() => quickLogin(k)} className={`rounded p-1.5 ${currentUser.username === k ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{k}</button>)}
        </div>
        <button onClick={logout} className="mt-3 w-full p-2 rounded border border-slate-800 text-sm flex items-center justify-center gap-2 hover:border-rose-500/40 hover:text-rose-300"><LogOut className="w-4 h-4" />注销</button>
      </div>
    </aside>

    <main className="flex-1 overflow-y-auto p-6 space-y-6">
      <header className="flex items-center justify-between"><h2 className="font-black text-lg">{activeTab === 'accountKyc' ? '本人实名认证' : nav.find((n: any) => n.id === activeTab)?.label || activeTab}</h2>{currentUser.role === UserRole.TRADER && <div className="text-sm text-teal-300">余额 {money(currentUser.balance)}</div>}</header>
      {actionNotice && <div className={`rounded-lg border p-3 text-sm flex items-center justify-between gap-4 ${actionNotice.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}><span>{actionNotice.text}</span><button onClick={() => setActionNotice(null)} className="text-xs font-bold">关闭</button></div>}

      {activeTab === 'dashboard' && <section className="space-y-6">
        {currentUser.role === UserRole.RISK_ANALYST ? <>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5"><h3 className="font-bold">Risk Analyst 工作台</h3><p className="text-xs text-slate-400 mt-1">面向风控分析师的 KYC 审核、评分实验、交易风控和审计日志入口。</p></div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">{[
            ['待审核 Trader KYC', kycList.filter(k => k.role === UserRole.TRADER && [KYCStatus.PENDING, KYCStatus.MANUAL_REVIEW].includes(k.status)).length],
            ['待处理交易', pendingTx.length], ['今日 REVIEW', todayTx.filter(t => t.status === RiskDecision.REVIEW).length], ['今日 STEP_UP', todayTx.filter(t => t.status === RiskDecision.STEP_UP).length], ['今日 BLOCK', todayTx.filter(t => t.status === RiskDecision.BLOCK).length], ['高风险 Trader', riskScores.filter(s => traderIds.has(s.userId) && (s.level === RiskLevel.HIGH || s.level === RiskLevel.CRITICAL || s.score < 50)).length]
          ].map(([k, v]) => <div key={String(k)} className="bg-slate-900 border border-slate-800 rounded-xl p-4"><div className="text-[10px] text-slate-400">{k}</div><div className="text-2xl font-black text-teal-300">{v}</div></div>)}</div>
          <Card title="本人实名认证">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div><div className="text-sm font-bold">{staffKycStatusText(kycProfile)}</div><p className="mt-1 text-xs text-slate-400">Risk Analyst 本人的认证状态独立于 Trader KYC 审核中心。</p></div>
              <button className="btn" onClick={openAccountKyc}>{kycProfile?.status === KYCStatus.INIT || !kycProfile ? '提交实名认证' : '查看 / 更新认证资料'}</button>
            </div>
          </Card>
          <Card title="最近风控审计日志">{logs.slice(0, 5).map(l => <div key={l.id}><Row left={`${l.actionType} / ${l.serviceName}`} right={new Date(l.timestamp).toLocaleString()} /></div>)}</Card>
        </> : currentUser.role === UserRole.GROWTH_ANALYST ? <>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5"><h3 className="font-bold">Growth Analyst 工作台</h3><p className="text-xs text-slate-400 mt-1">关注注册、认证、入金、首笔交易和活跃用户的转化表现。</p></div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <Stat title="日活跃用户 DAU" value={growthMetrics?.conversionMetrics?.dau ?? '-'} />
            <Stat title="月活跃用户 MAU" value={growthMetrics?.conversionMetrics?.mau ?? '-'} />
            <Stat title="注册转化率" value={growthMetrics?.conversionMetrics?.registerConversionRate || '-'} />
            <Stat title="KYC 通过率" value={growthMetrics?.conversionMetrics?.kycApprovalRate || '-'} />
            <Stat title="首单转化率" value={growthMetrics?.conversionMetrics?.firstTradeRate || '-'} />
            <Stat title="累计 GMV" value={growthMetrics ? money(growthMetrics.conversionMetrics?.totalGmv || 0) : '-'} />
          </div>
          <button onClick={() => setActiveTab('growthOverview')} className="btn">进入增长总览</button>
        </> : currentUser.role === UserRole.ADMIN ? <>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5"><h3 className="font-bold">Admin 全局管理工作台</h3><p className="text-xs text-slate-400 mt-1">系统最高管理员、运营管理、合规终审与平台配置中心。</p></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Stat title="用户总数" value={adminOverview.totalUsers ?? 0} /><Stat title="Trader 数量" value={adminOverview.traderCount ?? 0} /><Stat title="Risk Analyst 数量" value={adminOverview.riskCount ?? 0} /><Stat title="Growth Analyst 数量" value={adminOverview.growthCount ?? 0} />
            <Stat title="KYC 待审核" value={adminOverview.pendingKyc ?? 0} /><Stat title="KYC 已通过" value={adminOverview.verifiedKyc ?? 0} /><Stat title="KYC 已拒绝" value={adminOverview.rejectedKyc ?? 0} />
            <Stat title="待人工处理交易" value={adminOverview.pendingTransactions ?? 0} /><Stat title="今日交易" value={adminOverview.todayTransactions ?? 0} /><Stat title="今日 BLOCK" value={adminOverview.todayBlocks ?? 0} />
            <Stat title="今日 REVIEW / STEP_UP" value={adminOverview.todayReviewOrStepUp ?? 0} /><Stat title="累计充值金额" value={money(adminOverview.totalDeposits)} /><Stat title="累计 GMV" value={money(adminOverview.totalGmv)} />
            <Stat title="当前 AI Provider" value={adminOverview.aiProvider || 'mock'} /><Stat title="系统运行状态" value={adminOverview.systemStatus || '运行正常'} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveTab('adminUsers')} className="btn">用户管理</button><button onClick={() => setActiveTab('adminKyc')} className="btn">KYC 终审</button><button onClick={() => setActiveTab('adminTransactions')} className="btn">交易终审</button><button onClick={() => setActiveTab('auditLogs')} className="btn">审计日志</button><button onClick={() => setActiveTab('adminAi')} className="btn">AI 配置</button><button onClick={() => setActiveTab('adminDemo')} className="btn danger">数据重置</button>
          </div>
        </> : <div className="grid md:grid-cols-4 gap-4">
          <Stat title="账户状态" value={currentUser.role === UserRole.TRADER ? traderAccountStatusText(kycProfile) : cnKyc(kycProfile?.status)} />
          <Stat title="当前交易权限" value={currentUser.role === UserRole.TRADER ? access.label : `${myScore?.score ?? '-'} / 100`} />
          <Stat title="可交易产品" value={currentUser.role === UserRole.TRADER ? access.products : myScore?.decision || '-'} />
          <Stat title="可用资金" value={money(currentUser.balance)} />
          {currentUser.role === UserRole.TRADER && <div className="md:col-span-4 flex gap-3"><button onClick={() => setActiveTab('kyc')} className="btn">{hasActiveKycAccess(kycProfile) ? '更新认证资料' : '前往实名认证区'}</button><button onClick={() => setActiveTab('wallet')} className="btn">充值</button><button onClick={() => setActiveTab('products')} className="btn">查看投资推荐</button></div>}
        </div>}
      </section>}

      {activeTab === 'kyc' && <section className="space-y-5">
        {currentUser.role === UserRole.TRADER || currentUser.role === UserRole.GROWTH_ANALYST ? (
          <Card title={`身份认证：${traderAccountStatusText(kycProfile)}`}>
            {hasRetainedKycAccess(kycProfile) && <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">更新资料正在审核中。账号认证仍为已认证，有效期至 {kycProfile?.tradingAccessExpiresAt}，在此期间可以继续交易。</div>}
            <div className="grid md:grid-cols-2 gap-3">
              {Object.entries(kycForm).map(([k, v]) => <input key={k} className="input" value={v} onChange={e => setKycForm({ ...kycForm, [k]: e.target.value })} placeholder={k} />)}
            </div>
            <button onClick={submitKyc} className="btn mt-3">提交 / 更新认证资料</button>
          </Card>
        ) : (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">实名合规身份 KYC 审核中心</h3>
                  <p className="mt-1 text-xs text-slate-400">查看申请人完整认证资料和状态，待处理工单在下方审核区完成流转。</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-300">全部 {visibleKycList.length}</span>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-300">待处理 {reviewableKycList.length}</span>
                </div>
              </div>
            </div>

            <Card title="KYC 申请资料列表">
              <Table headers={['用户与角色', '真实姓名', '证件号码', '证件到期时间', '国籍', 'IP 地址', '提交设备', '当前状态', '提交时间']}>
                {visibleKycList.map(k => <tr key={k.id} className="hover:bg-slate-800/30">
                  <Td><div className="font-bold text-white">{k.username || k.userId}</div><div className="mt-1 text-[10px] text-teal-300">{k.role}</div></Td>
                  <Td>{k.name || '-'}</Td>
                  <Td><span className="font-mono text-[11px]">{k.idNumber || '-'}</span></Td>
                  <Td>{k.idDocumentExpiresAt || '-'}</Td>
                  <Td>{k.nationality || '-'}</Td>
                  <Td><span className="font-mono text-[11px]">{k.ipAddress || '-'}</span></Td>
                  <Td><span className="block max-w-48 truncate" title={k.deviceInfo}>{k.deviceInfo || '-'}</span></Td>
                  <Td><KycBadge status={k.status} /></Td>
                  <Td>{k.createdAt ? new Date(k.createdAt).toLocaleString() : '-'}</Td>
                </tr>)}
              </Table>
            </Card>

            <Card title="待审核工单处理区">
              {currentUser.role === UserRole.RISK_ANALYST && kycProfile?.status !== KYCStatus.VERIFIED ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-5 text-center">
                  <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-rose-300" />
                  <div className="text-sm font-bold text-rose-200">当前无法审核他人 KYC</div>
                  <p className="mt-1 text-xs text-slate-300">Risk Analyst 自身 KYC 必须为 VERIFIED，才能处理 Trader 的认证申请。</p>
                </div>
              ) : reviewableKycList.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="label">选择待处理 Trader</label>
                      <select className="input" value={selectedKycAudit?.id || ''} onChange={e => setSelectedKycAuditId(e.target.value)}>
                        {reviewableKycList.map(k => <option key={k.id} value={k.id}>{k.username} / {k.name} / {k.status}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">审核意见</label>
                      <input value={auditComment} onChange={e => setAuditComment(e.target.value)} className="input" placeholder="填写审核结论或补充说明" />
                    </div>
                  </div>
                  {selectedKycAudit && <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300">
                    当前工单：<strong className="text-white">{selectedKycAudit.username} / {selectedKycAudit.name}</strong>
                    <span className="ml-2 text-slate-500">证件到期：{selectedKycAudit.idDocumentExpiresAt || '-'}</span>
                  </div>}
                  <div className="flex flex-wrap justify-end gap-2">
                    <button className="btn danger" onClick={() => selectedKycAudit && openKycAction(selectedKycAudit, KYCStatus.REJECTED, '拒绝', true)}>拒绝</button>
                    {selectedKycAudit?.status === KYCStatus.PENDING && <button className="btn bg-amber-600 hover:bg-amber-500" onClick={() => openKycAction(selectedKycAudit, KYCStatus.MANUAL_REVIEW, '转人工核验', true)}>转人工核验</button>}
                    <button className="btn" onClick={() => selectedKycAudit && openKycAction(selectedKycAudit, KYCStatus.VERIFIED, '通过', false)}>通过</button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-8 text-center text-sm text-slate-500">当前没有待处理的 KYC 工单。</div>
              )}
            </Card>
          </>
        )}
      </section>}

      {activeTab === 'accountKyc' && [UserRole.RISK_ANALYST, UserRole.GROWTH_ANALYST].includes(currentUser.role) && <section className="space-y-5">
        <Card title={`本人实名认证：${staffKycStatusText(kycProfile)}`}>
          {hasRetainedKycAccess(kycProfile) && <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">更新资料正在审核中。原认证仍在有效期内，有效期至 {kycProfile?.tradingAccessExpiresAt}。</div>}
          {kycProfile?.status === KYCStatus.PENDING && !hasRetainedKycAccess(kycProfile) && <div className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-200">认证资料已提交，当前正在等待 Admin 终审。</div>}
          {kycProfile?.status === KYCStatus.REJECTED && <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">上次认证未通过，请根据审核意见修改资料后重新提交。</div>}
          {kycProfile?.status === KYCStatus.MANUAL_REVIEW && <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">认证资料需要人工核验，请等待 Admin 处理或按要求补充资料。</div>}
          <div className="grid gap-3 md:grid-cols-2">{Object.entries(kycForm).map(([key, value]) => {
            const automatic = key === 'deviceInfo' || key === 'ipAddress';
            const labels: Record<string, string> = { name: '真实姓名', idNumber: '证件号码', dob: '出生日期', nationality: '国籍', idType: '证件类型', idDocumentExpiresAt: '证件到期时间', deviceInfo: '提交设备（系统自动记录）', ipAddress: 'IP 地址（系统自动记录）' };
            return <label key={key}><span className="label">{labels[key] || key}</span><input className={`input ${automatic ? 'cursor-not-allowed opacity-60' : ''}`} readOnly={automatic} type={key === 'dob' || key === 'idDocumentExpiresAt' ? 'date' : 'text'} value={value} onChange={e => !automatic && setKycForm({ ...kycForm, [key]: e.target.value })} /></label>;
          })}</div>
          <p className="mt-3 text-xs text-slate-500">日期提交时统一保存为 YYYY-MM-DD；浏览器可能按本地格式显示为 YYYY/MM/DD。设备与 IP 将在提交时由系统自动记录。</p>
          <div className="mt-4 flex flex-wrap justify-end gap-2"><button className="btn" onClick={() => setActiveTab(currentUser.role === UserRole.GROWTH_ANALYST ? 'growthOverview' : 'dashboard')}>返回工作台</button><button className="btn" onClick={submitKyc}>提交 / 更新认证资料</button></div>
        </Card>
      </section>}

      {activeTab === 'risk' && currentUser.role === UserRole.RISK_ANALYST && <section className="grid lg:grid-cols-3 gap-5">
        <Card title="算分模型输入参数 (Scorecard Inputs)">
          <label className="label">待算目标测试用户ID</label><select className="input" value={simParams.userId} onChange={e => selectRiskUser(e.target.value)}><option value="">-- 选择用户 --</option>{kycList.filter(k => k.role === UserRole.TRADER).map(k => <option key={k.userId} value={k.userId}>{accountKycOptionText(k)}</option>)}</select>
          <p className="text-[11px] text-teal-300 mt-2">评分卡使用 Trader 实际账号认证结果计算；资料更新的审核状态不会覆盖仍在有效期内的账号认证资格。</p>
          {selectedSimKyc && <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs"><Row left="实际账号认证结果" right={accountKycResult(selectedSimKyc)} /><Row left="资料审核状态" right={selectedSimKyc.status} /><Row left="认证资格有效期" right={selectedSimKyc.tradingAccessExpiresAt || '-'} /></div>}
          <Slider label="IP 归属跃迁次数" value={simParams.ipChanges} max={5} onChange={v => setSimParams({ ...simParams, ipChanges: v })} />
          <Slider label="设备环境切换频率" value={simParams.deviceSwitches} max={4} onChange={v => setSimParams({ ...simParams, deviceSwitches: v })} />
          <Slider label="1分钟活跃交易频率" value={simParams.txFrequency} min={1} max={25} onChange={v => setSimParams({ ...simParams, txFrequency: v })} />
          <label className="flex items-center gap-2 text-xs bg-slate-950 border border-slate-800 rounded p-3"><input type="checkbox" checked={simParams.blacklistHit} onChange={e => setSimParams({ ...simParams, blacklistHit: e.target.checked })} />直接命入洗钱欺诈黑名单库</label>
          <button onClick={saveScore} disabled={!simParams.userId || savingScore} className="btn w-full mt-3">{savingScore ? '保存中...' : '确认，保存参数'}</button>
        </Card>
        <Card title="实时评分器测算结果反馈 (Mock/Gemini LLM Output)" className="lg:col-span-2">
          {preview ? <div className="space-y-4"><div className="grid grid-cols-3 gap-3"><Stat title="量化信用得分" value={preview.score} /><Stat title="估算违约 PD" value={`${(preview.pd * 100).toFixed(2)}%`} /><Stat title="风险等级" value={preview.level} /></div><div className="bg-slate-950 border border-slate-800 rounded p-3 text-xs whitespace-pre-wrap">实时预览：当前参数组合会得到 {preview.score} 分，决策建议为 {preview.decision}。拖动左侧参数会立即刷新；点击“确认，保存参数”后才写入服务端。</div><pre className="bg-slate-950 border border-slate-800 rounded p-3 text-[11px] whitespace-pre-wrap">{preview.breakdown}</pre></div> : <div className="p-10 text-center text-slate-500 text-sm">请选择左侧评测目标用户。选择后，拖动参数会实时生成评分、PD 和风控解释预览。</div>}
        </Card>
      </section>}

      {activeTab === 'products' && <section className="space-y-4"><div className="flex justify-between"><p className="text-sm text-slate-400">{hasActiveKycAccess(kycProfile) ? `你的账户认证资格有效，当前可交易：${access.products}` : '完成身份认证后，系统将根据账户状态为你开放相应产品。'}</p><button onClick={() => setActiveTab('transactions')} className="btn">查看交易记录</button></div><div className="grid md:grid-cols-3 gap-4">{products.map(p => { const eligible = hasActiveKycAccess(kycProfile) && access.levels.includes(p.riskLevel); return <div key={p.id || p.name} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3"><div className="flex justify-between"><h3 className="font-bold">{p.name}</h3><span className={eligible ? 'tag ok' : 'tag'}>{eligible ? '适合当前账户' : '暂不可交易'}</span></div><p className="text-xs text-slate-400">{cnRisk(p.riskLevel)} / {p.expectedReturn}</p><p className="text-xs text-slate-500">{eligible ? '该产品符合你当前的账户状态和交易权限。' : '该产品风险等级较高，暂不符合你当前的交易准入条件。你可以选择风险等级较低的产品。'}</p><button disabled={!eligible} onClick={() => openTrade(p)} className="btn w-full disabled:opacity-40">{eligible ? '发起交易' : '暂不可交易'}</button></div>; })}</div></section>}

      {activeTab === 'wallet' && <Card title="可用资金总头寸 (Auth Fund)"><div className="text-2xl font-black text-teal-300 mb-3">{money(currentUser.balance)}</div><div className="flex gap-2"><input className="input" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="充值金额" /><button onClick={deposit} className="btn">充值</button></div>{deposits.map(d => <div key={d.id}><Row left={`${money(d.amount)} / ${d.status}`} right={new Date(d.createdAt).toLocaleString()} /></div>)}</Card>}

      {activeTab === 'transactions' && [UserRole.TRADER, UserRole.RISK_ANALYST].includes(currentUser.role) && <Card title={currentUser.role === UserRole.TRADER ? '交易记录' : '交易风控台'}>
        {currentUser.role !== UserRole.TRADER && <div className="mb-4 grid gap-3 md:grid-cols-6">
          <select className="input" value={txFilters.trader} onChange={e => setTxFilters({ ...txFilters, trader: e.target.value })}><option value="">全部 Trader</option>{transactionUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}</select>
          <select className="input" value={txFilters.status} onChange={e => setTxFilters({ ...txFilters, status: e.target.value })}><option value="">全部状态</option>{Object.values(RiskDecision).map(status => <option key={status} value={status}>{status}</option>)}</select>
          <div><label className="label">开始日期</label><input type="date" className="input" value={txFilters.dateFrom} onChange={e => setTxFilters({ ...txFilters, dateFrom: e.target.value })} /></div>
          <div><label className="label">结束日期</label><input type="date" className="input" value={txFilters.dateTo} min={txFilters.dateFrom || undefined} onChange={e => setTxFilters({ ...txFilters, dateTo: e.target.value })} /></div>
          <input className="input" value={txFilters.keyword} onChange={e => setTxFilters({ ...txFilters, keyword: e.target.value })} placeholder="编号 / 产品 / 原因" />
          <button className="btn" onClick={() => setTxFilters({ trader: '', status: '', keyword: '', dateFrom: '', dateTo: '' })}>重置筛选</button>
        </div>}
        <div className="mb-3 text-xs text-slate-500">共 {filteredTransactions.length} 条交易</div>
        <Table headers={['交易编号', '申请时间', 'Trader', '产品 / 资产名称', '金额', '状态', '处理说明', '操作']}>{filteredTransactions.map(tx => <tr key={tx.id}><Td>#{tx.id.slice(-8)}</Td><Td>{new Date(tx.createdAt).toLocaleString()}</Td><Td>{tx.username || tx.userId}</Td><Td>{tx.assetType}</Td><Td>{money(tx.amount)}</Td><Td>{currentUser.role === UserRole.TRADER ? txStatusText(tx.status) : tx.status}</Td><Td>{currentUser.role === UserRole.TRADER ? sanitizeReason(tx.reason, tx.status) : tx.reason}</Td><Td>{[RiskDecision.REVIEW, RiskDecision.MANUAL_REVIEW, RiskDecision.STEP_UP].includes(tx.status) && currentUser.role !== UserRole.TRADER ? <><button className="mini" onClick={() => auditTx(tx.id, RiskDecision.ALLOW)}>ALLOW</button><button className="mini danger" onClick={() => auditTx(tx.id, RiskDecision.BLOCK)}>BLOCK</button></> : <span className="text-slate-500">只读</span>}</Td></tr>)}</Table>
      </Card>}

      {activeTab === 'auditLogs' && <Card title={currentUser.role === UserRole.ADMIN ? '审计日志中心' : 'Trader 风控审计日志'}>
        <div className="mb-4 grid gap-3 md:grid-cols-4 xl:grid-cols-9">
          {currentUser.role === UserRole.ADMIN && <select className="input" value={logFilters.role} onChange={e => setLogFilters({ ...logFilters, role: e.target.value, user: '' })}><option value="">全部角色</option>{logRoleOptions.map(role => <option key={role} value={role}>{role}</option>)}</select>}
          <select className="input" disabled={currentUser.role === UserRole.ADMIN && !logFilters.role} value={logFilters.user} onChange={e => setLogFilters({ ...logFilters, user: e.target.value })}><option value="">{currentUser.role === UserRole.RISK_ANALYST ? '全部 Trader' : logFilters.role ? `全部 ${logFilters.role}` : '请先选择角色'}</option>{logUserOptions.map(user => <option key={user.value} value={user.value}>{user.label}</option>)}</select>
          <select className="input" value={logFilters.action} onChange={e => setLogFilters({ ...logFilters, action: e.target.value })}><option value="">全部动作</option>{logActions.map(action => <option key={action} value={action}>{action}</option>)}</select>
          <select className="input" value={logFilters.service} onChange={e => setLogFilters({ ...logFilters, service: e.target.value })}><option value="">全部服务</option>{logServices.map(service => <option key={service} value={service}>{service}</option>)}</select>
          <select className="input" value={logFilters.riskFlag} onChange={e => setLogFilters({ ...logFilters, riskFlag: e.target.value })}><option value="">全部风险标记</option><option value="true">RISK_DETECTED</option><option value="false">NORMAL</option></select>
          <div><label className="label">开始日期</label><input type="date" className="input" value={logFilters.dateFrom} onChange={e => setLogFilters({ ...logFilters, dateFrom: e.target.value })} /></div>
          <div><label className="label">结束日期</label><input type="date" className="input" value={logFilters.dateTo} min={logFilters.dateFrom || undefined} onChange={e => setLogFilters({ ...logFilters, dateTo: e.target.value })} /></div>
          <input className="input" value={logFilters.keyword} onChange={e => setLogFilters({ ...logFilters, keyword: e.target.value })} placeholder="搜索 payload / 响应" />
          <button className="btn" onClick={() => setLogFilters({ role: '', user: '', action: '', service: '', riskFlag: '', keyword: '', dateFrom: '', dateTo: '' })}>重置筛选</button>
        </div>
        <div className="mb-3 text-xs text-slate-500">{currentUser.role === UserRole.RISK_ANALYST ? '仅显示 Trader 相关日志，' : '显示所有角色日志，'}共 {filteredLogs.length} 条</div>
        <Table headers={['时间', '操作人', '操作人角色', '动作类型', '目标对象 / 服务', '请求 payload', '响应结果', 'riskFlag', '操作结果']}>{filteredLogs.map(l => <tr key={l.id}><Td>{new Date(l.timestamp).toLocaleString()}</Td><Td>{getLogUserLabel(l)}</Td><Td>{getLogUserRole(l)}</Td><Td>{l.actionType}</Td><Td>{l.serviceName}</Td><Td>{currentUser.role !== UserRole.ADMIN && /AI|CONFIG|SYSTEM|RESET|GEMINI|OLLAMA|KEY/i.test(`${l.actionType} ${l.serviceName}`) ? '敏感系统配置内容已脱敏' : l.requestPayload}</Td><Td>{currentUser.role !== UserRole.ADMIN && /AI|CONFIG|SYSTEM|RESET|GEMINI|OLLAMA|KEY/i.test(`${l.actionType} ${l.serviceName}`) ? '敏感系统配置内容已脱敏' : l.responseResult}</Td><Td>{l.riskFlag ? 'RISK_DETECTED' : 'NORMAL'}</Td><Td>{/error|false|fail/i.test(l.responseResult || '') ? '失败' : '成功'}</Td></tr>)}</Table>
      </Card>}

      {activeTab === 'adminUsers' && currentUser.role === UserRole.ADMIN && <section className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4"><select className="input" value={adminUserFilters.role} onChange={e => setAdminUserFilters({ ...adminUserFilters, role: e.target.value })}><option value="">全部角色</option>{Object.values(UserRole).map(role => <option key={role}>{role}</option>)}</select><select className="input" value={adminUserFilters.kycStatus} onChange={e => setAdminUserFilters({ ...adminUserFilters, kycStatus: e.target.value })}><option value="">全部 KYC 状态</option>{Object.values(KYCStatus).map(status => <option key={status}>{status}</option>)}</select><select className="input" value={adminUserFilters.accountStatus} onChange={e => setAdminUserFilters({ ...adminUserFilters, accountStatus: e.target.value })}><option value="">全部账户状态</option><option value="ACTIVE">已启用</option><option value="DISABLED">已禁用</option></select><button className="btn" onClick={() => setAdminUserFilters({ role: '', kycStatus: '', accountStatus: '' })}>重置筛选</button></div>
        <Card title="全量用户管理"><Table headers={['用户名', '角色', 'KYC 状态', '证件有效期', '余额', '注册时间', '最近登录', '账户状态', '操作']}>{filteredAdminUsers.map(user => <tr key={user.id}><Td>{user.username}</Td><Td>{user.role}</Td><Td>{user.kycStatus}</Td><Td>{user.idDocumentExpiresAt || '-'}</Td><Td>{money(user.balance)}</Td><Td>{new Date(user.createdAt).toLocaleString()}</Td><Td>{user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : '-'}</Td><Td>{user.accountStatus === 'DISABLED' ? '已禁用' : '已启用'}</Td><Td><button className="mini" onClick={() => setSelectedAdminUser(user)}>详情</button><button className={`mini ${user.accountStatus === 'DISABLED' ? '' : 'danger'}`} onClick={() => updateAdminUserStatus(user.id, user.accountStatus === 'DISABLED' ? 'ACTIVE' : 'DISABLED')}>{user.accountStatus === 'DISABLED' ? '启用' : '禁用'}</button></Td></tr>)}</Table></Card>
        {selectedAdminUser && <Card title={`用户详情：${selectedAdminUser.username}`}><div className="grid gap-x-6 md:grid-cols-2"><Row left="真实姓名" right={selectedAdminUser.kycName || '-'} /><Row left="KYC 摘要" right={`${selectedAdminUser.kycStatus} / ${selectedAdminUser.idDocumentExpiresAt || '无有效期'}`} /><Row left="交易记录摘要" right={`${selectedAdminUser.transactionCount} 笔 / GMV ${money(selectedAdminUser.transactionGmv)}`} /><Row left="账户余额" right={money(selectedAdminUser.balance)} /></div></Card>}
      </section>}

      {activeTab === 'adminKyc' && currentUser.role === UserRole.ADMIN && <section className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3"><select className="input" value={adminKycFilters.role} onChange={e => setAdminKycFilters({ ...adminKycFilters, role: e.target.value })}><option value="">全部角色</option>{Object.values(UserRole).map(role => <option key={role}>{role}</option>)}</select><select className="input" value={adminKycFilters.status} onChange={e => setAdminKycFilters({ ...adminKycFilters, status: e.target.value })}><option value="">全部状态</option>{Object.values(KYCStatus).map(status => <option key={status}>{status}</option>)}</select><button className="btn" onClick={() => setAdminKycFilters({ role: '', status: '' })}>重置筛选</button></div>
        <Card title="全量 KYC 终审列表"><Table headers={['用户', '角色', '姓名', '证件号', '证件到期时间', '状态', 'verifiedAt', '终审操作']}>{filteredAdminKyc.map(profile => {
          const expired = profile.status === KYCStatus.VERIFIED && isExpiredKyc(profile);
          return <tr key={profile.id}><Td>{profile.username}</Td><Td>{profile.role}</Td><Td>{profile.name}</Td><Td>{profile.idNumber}</Td><Td>{profile.idDocumentExpiresAt || '系统账号'}</Td><Td>{adminKycStatusText(profile)}</Td><Td>{profile.verifiedAt ? new Date(profile.verifiedAt).toLocaleString() : '-'}</Td><Td><div className="flex min-w-max flex-wrap gap-2">
            {profile.status === KYCStatus.INIT && <span className="text-slate-500">等待用户提交</span>}
            {profile.status === KYCStatus.PENDING && <><button className="mini" onClick={() => openKycAction(profile, KYCStatus.VERIFIED, '通过', false)}>通过</button><button className="mini danger" onClick={() => openKycAction(profile, KYCStatus.REJECTED, '拒绝', true)}>拒绝</button><button className="mini" onClick={() => openKycAction(profile, KYCStatus.MANUAL_REVIEW, '转人工核验', true)}>转人工核验</button></>}
            {profile.status === KYCStatus.MANUAL_REVIEW && <><button className="mini" onClick={() => openKycAction(profile, KYCStatus.VERIFIED, '通过', false)}>通过</button><button className="mini danger" onClick={() => openKycAction(profile, KYCStatus.REJECTED, '拒绝', true)}>拒绝</button></>}
            {profile.status === KYCStatus.REJECTED && <><button className="mini" onClick={() => setSelectedAdminKyc(profile)}>查看详情</button><span className="self-center text-slate-500">等待用户重新提交</span></>}
            {profile.status === KYCStatus.VERIFIED && <><button className="mini" onClick={() => setSelectedAdminKyc(profile)}>查看详情</button><button className="mini danger" onClick={() => openKycAction(profile, KYCStatus.INIT, '要求重新认证', true)}>要求重新认证</button>{expired && <button className="mini" onClick={() => openKycAction(profile, KYCStatus.MANUAL_REVIEW, '转人工核验', true)}>转人工核验</button>}</>}
          </div></Td></tr>;
        })}</Table></Card>
      </section>}

      {activeTab === 'adminTransactions' && currentUser.role === UserRole.ADMIN && <section className="space-y-4">
        <div className="flex flex-wrap gap-3"><select className="input w-auto" value={adminTxStatus} onChange={e => setAdminTxStatus(e.target.value)}><option value="">全部交易状态</option>{Object.values(RiskDecision).map(status => <option key={status}>{status}</option>)}</select><input className="input max-w-md" value={txAuditComment} onChange={e => setTxAuditComment(e.target.value)} placeholder="终审意见" /></div>
        <Card title="全量交易终审"><Table headers={['交易编号', '用户', '产品 / 资产', '金额', '当前状态', '系统判定 / reason', '处理人', '处理时间', '操作']}>{filteredAdminTransactions.map(tx => <tr key={tx.id}><Td>#{tx.id.slice(-8)}</Td><Td>{tx.username || tx.userId}</Td><Td>{tx.assetType}</Td><Td>{money(tx.amount)}</Td><Td>{tx.status}</Td><Td><button className="text-left text-xs text-slate-300" onClick={() => setSelectedAdminTransaction(tx)}>{tx.reason}</button></Td><Td>{tx.reviewedBy || '-'}</Td><Td>{tx.reviewedAt ? new Date(tx.reviewedAt).toLocaleString() : '-'}</Td><Td>{[RiskDecision.REVIEW, RiskDecision.MANUAL_REVIEW, RiskDecision.STEP_UP].includes(tx.status) ? <><button className="mini" onClick={() => adminAuditTransaction(tx.id, RiskDecision.ALLOW)}>ALLOW</button><button className="mini danger" onClick={() => adminAuditTransaction(tx.id, RiskDecision.BLOCK)}>BLOCK</button></> : <button className="mini" onClick={() => setSelectedAdminTransaction(tx)}>查看详情</button>}</Td></tr>)}</Table></Card>
      </section>}

      {activeTab === 'adminAi' && currentUser.role === UserRole.ADMIN && <Card title="AI 配置中心"><div className="grid gap-4 md:grid-cols-2"><div><label className="label">AI_PROVIDER</label><select className="input" value={aiForm.provider} onChange={e => setAiForm({ ...aiForm, provider: e.target.value })}><option value="mock">mock</option><option value="ollama">ollama</option><option value="gemini">gemini</option></select></div><div><label className="label">OLLAMA_BASE_URL</label><input className="input" value={aiForm.ollama_url} onChange={e => setAiForm({ ...aiForm, ollama_url: e.target.value })} /></div><div className="md:col-span-2"><label className="label">GEMINI_API_KEY（脱敏显示）</label><input type="password" className="input" value={aiForm.gemini_api_key} onChange={e => setAiForm({ ...aiForm, gemini_api_key: e.target.value })} placeholder={aiConfig.gemini_api_key_masked || '未配置'} /></div></div><div className="mt-4 flex gap-2"><button className="btn" onClick={saveAiConfig}>保存配置</button><button className="btn" onClick={async () => { try { const res = await api('/api/ai/test', { method: 'POST' }); setActionNotice({ type: 'success', text: res.message }); } catch (e: any) { setActionNotice({ type: 'error', text: e.message }); } }}>测试连接</button></div></Card>}

      {activeTab === 'adminSystem' && currentUser.role === UserRole.ADMIN && <Card title="系统配置"><div className="grid gap-4 md:grid-cols-2"><label><span className="label">默认币种</span><input className="input" value={systemConfig.defaultCurrency || ''} onChange={e => setSystemConfig({ ...systemConfig, defaultCurrency: e.target.value })} /></label><label><span className="label">单次充值上限</span><input type="number" className="input" value={systemConfig.maxDepositAmount || 0} onChange={e => setSystemConfig({ ...systemConfig, maxDepositAmount: Number(e.target.value) })} /></label><label><span className="label">单次交易金额上限</span><input type="number" className="input" value={systemConfig.maxTransactionAmount || 0} onChange={e => setSystemConfig({ ...systemConfig, maxTransactionAmount: Number(e.target.value) })} /></label><label><span className="label">KYC 到期提醒天数</span><input type="number" className="input" value={systemConfig.kycExpiryReminderDays || 30} onChange={e => setSystemConfig({ ...systemConfig, kycExpiryReminderDays: Number(e.target.value) })} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!systemConfig.allowUnverifiedMockDeposit} onChange={e => setSystemConfig({ ...systemConfig, allowUnverifiedMockDeposit: e.target.checked })} />允许未 KYC 模拟充值</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!systemConfig.enableAiRecommendation} onChange={e => setSystemConfig({ ...systemConfig, enableAiRecommendation: e.target.checked })} />开启 AI 推荐理由</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!systemConfig.mockMode} onChange={e => setSystemConfig({ ...systemConfig, mockMode: e.target.checked })} />开启 mock 模式</label><label><span className="label">系统公告</span><input className="input" value={systemConfig.announcement || ''} onChange={e => setSystemConfig({ ...systemConfig, announcement: e.target.value })} /></label></div><button className="btn mt-4" onClick={saveSystemConfig}>保存系统配置</button></Card>}

      {activeTab === 'adminDemo' && currentUser.role === UserRole.ADMIN && <Card title="演示数据控制台"><p className="mb-4 text-xs text-slate-400">危险操作需要二次确认，执行后保持在当前页面查看结果。</p><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[['all', '重置所有演示数据'], ['traderKyc', '重置 Trader KYC'], ['traderBalances', '重置 Trader 余额'], ['transactions', '重置交易记录'], ['deposits', '重置充值记录'], ['auditLogs', '重置审计日志'], ['defaults', '恢复默认 mock 数据']].map(([section, label]) => <button key={section} className="btn danger justify-center" onClick={() => resetDemoData(section, label)}><RotateCcw className="h-4 w-4" />{label}</button>)}</div></Card>}
      {['growthOverview', 'growthFunnel', 'growthSegments', 'growthExperiments'].includes(activeTab) && growthError && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6"><h4 className="text-sm font-bold text-amber-200">增长数据暂未开放</h4><p className="mt-1 text-xs text-slate-300">{growthError}</p></div>}
      {activeTab === 'growthOverview' && !growthMetrics && currentUser.role === UserRole.GROWTH_ANALYST && <Card title="本人实名认证">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="text-sm font-bold">{staffKycStatusText(kycProfile)}</div><p className="mt-1 text-xs text-slate-400">请先提交或完成本人实名认证，认证通过后即可使用 Growth 分析能力。</p></div><button className="btn" onClick={openAccountKyc}>{kycProfile?.status === KYCStatus.INIT || !kycProfile ? '提交实名认证' : '查看 / 更新认证资料'}</button></div>
      </Card>}

      {activeTab === 'growthOverview' && growthMetrics && <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-base font-bold">增长总览</h3><p className="mt-1 text-xs text-slate-400">查看核心经营指标、渠道表现和产品推荐转化。</p></div><div className="flex flex-wrap gap-2"><select className="input w-auto"><option>近 30 天</option><option>近 7 天</option><option>本季度</option></select><select className="input w-auto"><option>全部渠道</option>{(growthMetrics.channelAnalytics || []).map((c: any) => <option key={c.channel}>{c.channel}</option>)}</select><select className="input w-auto"><option>全部用户类型</option><option>新用户</option><option>活跃用户</option><option>高价值用户</option></select></div></div>
        <Card title="本人实名认证">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="text-sm font-bold">{staffKycStatusText(kycProfile)}</div><p className="mt-1 text-xs text-slate-400">完成本人实名认证后，才可持续使用 Growth 聚合分析能力。</p></div><button className="btn" onClick={openAccountKyc}>{kycProfile?.status === KYCStatus.INIT || !kycProfile ? '提交实名认证' : '查看 / 更新认证资料'}</button></div>
        </Card>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{[['DAU', 'dau'], ['WAU', 'wau'], ['MAU', 'mau'], ['新增注册用户', 'newRegistrations'], ['注册转化率', 'registerConversionRate'], ['KYC 提交率', 'kycSubmissionRate'], ['KYC 通过率', 'kycApprovalRate'], ['首充转化率', 'firstDepositRate'], ['首单转化率', 'firstTradeRate'], ['活跃交易者', 'activeTraders']].map(([label, key]) => <React.Fragment key={key}><Stat title={label} value={growthMetrics.conversionMetrics?.[key] ?? '-'} /></React.Fragment>)}<Stat title="累计 GMV" value={money(growthMetrics.conversionMetrics?.totalGmv)} /><Stat title="人均 GMV / ARPU" value={money(growthMetrics.conversionMetrics?.arpu)} /></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Stat title="本期最大流失节点" value={growthMetrics.overviewSummary?.largestDrop} /><Stat title="本期最高价值渠道" value={growthMetrics.overviewSummary?.highestValueChannel} /><Stat title="本期最高 GMV 产品" value={growthMetrics.overviewSummary?.highestGmvProduct} /><Stat title="AI 摘要结论" value={growthMetrics.overviewSummary?.aiConclusion} /></div>
        <div className="flex gap-2 border-b border-slate-800"><button onClick={() => setGrowthOverviewTab('channels')} className={`px-3 py-2 text-sm ${growthOverviewTab === 'channels' ? 'border-b-2 border-teal-400 text-white' : 'text-slate-400'}`}>渠道分析</button><button onClick={() => setGrowthOverviewTab('products')} className={`px-3 py-2 text-sm ${growthOverviewTab === 'products' ? 'border-b-2 border-teal-400 text-white' : 'text-slate-400'}`}>产品推荐转化</button></div>
        {growthOverviewTab === 'channels' ? <Card title="渠道分析"><Table headers={['渠道', 'Visit', 'Register', 'KYC 通过', '首次入金', '首次交易', 'GMV', '注册转化率', '首单转化率']}>{(growthMetrics.channelAnalytics || []).map((item: any) => <tr key={item.channel}><Td>{item.channel}</Td><Td>{item.visit}</Td><Td>{item.register}</Td><Td>{item.kycApproved}</Td><Td>{item.firstDeposit}</Td><Td>{item.firstTrade}</Td><Td>{money(item.gmv)}</Td><Td>{item.registerRate}</Td><Td>{item.firstTradeRate}</Td></tr>)}</Table></Card> : <Card title="产品推荐转化分析"><Table headers={['产品', '曝光', '点击', '交易申请', '通过', 'BLOCK', 'GMV', '点击率', '申请转化率', '通过率']}>{(growthMetrics.productAnalytics || []).map((item: any) => <tr key={item.product}><Td>{item.product}</Td><Td>{item.exposure}</Td><Td>{item.clicks}</Td><Td>{item.applications}</Td><Td>{item.approved}</Td><Td>{item.blocked}</Td><Td>{money(item.gmv)}</Td><Td>{item.clickRate}</Td><Td>{item.applicationRate}</Td><Td>{item.approvalRate}</Td></tr>)}</Table></Card>}
      </section>}

      {activeTab === 'growthFunnel' && growthMetrics && <section className="space-y-5">
        <div><h3 className="text-base font-bold">漏斗与摩擦</h3><p className="mt-1 text-xs text-slate-400">定位用户流失、KYC 转化阻力和交易风控摩擦。</p></div>
        <Card title="九阶段用户增长转化漏斗"><Table headers={['阶段', '人数', '相对上一阶段', '相对 Visit', '阶段流失', '规模']}>{(growthMetrics.funnelData || []).map((item: any) => <tr key={item.stage}><Td>{item.stage}</Td><Td>{item.value}</Td><Td>{item.previousRate}</Td><Td>{item.visitRate}</Td><Td>{item.dropOff}</Td><Td><div className="h-2 min-w-36 overflow-hidden rounded bg-slate-800"><div className="h-full bg-teal-500" style={{ width: `${Math.max(2, Number.parseFloat(item.visitRate))}%` }} /></div></Td></tr>)}</Table></Card>
        <div className="grid gap-5 xl:grid-cols-2"><Card title="KYC 转化分析"><div className="grid grid-cols-2 gap-x-5">{[['KYC 开始人数', 'started'], ['KYC 提交人数', 'submitted'], ['KYC 通过人数', 'approved'], ['KYC 拒绝人数', 'rejected'], ['人工核验人数', 'manualReview'], ['平均审核时长', 'averageReviewHours'], ['KYC 通过率', 'approvalRate'], ['KYC 拒绝率', 'rejectionRate'], ['证件即将到期', 'expiringSoon'], ['证件已过期', 'expired']].map(([label, key]) => <React.Fragment key={key}><Row left={label} right={key === 'averageReviewHours' ? `${growthMetrics.kycAnalysis?.[key]} 小时` : growthMetrics.kycAnalysis?.[key]} /></React.Fragment>)}</div></Card><Card title="风控摩擦影响"><p className="mb-3 text-xs text-slate-400">仅展示聚合统计，不包含内部模型因子。</p><div className="grid grid-cols-2 gap-x-5">{[['产品适当性 BLOCK', 'productSuitabilityBlocks'], ['KYC 导致交易阻断', 'kycBlocks'], ['REVIEW 交易', 'reviewCount'], ['STEP_UP 交易', 'stepUpCount'], ['人工复核交易', 'manualReviewCount'], ['人工处理平均时长', 'averageManualHandlingHours'], ['REVIEW 最终通过率', 'reviewApprovalRate'], ['STEP_UP 最终通过率', 'stepUpApprovalRate'], ['BLOCK 后流失率', 'postBlockChurnRate']].map(([label, key]) => <React.Fragment key={key}><Row left={label} right={key === 'averageManualHandlingHours' ? `${growthMetrics.riskFriction?.[key]} 小时` : growthMetrics.riskFriction?.[key]} /></React.Fragment>)}</div></Card></div>
      </section>}

      {activeTab === 'growthSegments' && growthMetrics && <section className="space-y-5">
        <div><h3 className="text-base font-bold">机会人群</h3><p className="mt-1 text-xs text-slate-400">识别可运营人群并查看脱敏明细。</p></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{(growthMetrics.opportunitySegments || []).map((item: any) => <button key={item.name} onClick={() => setSelectedGrowthSegment(item)} className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-left hover:border-teal-500/50"><div className="flex justify-between gap-3"><h4 className="text-sm font-bold">{item.name}</h4><span className="text-xl font-black text-teal-300">{item.count}</span></div><p className="mt-2 text-xs text-slate-400">{item.description}</p><p className="mt-3 border-t border-slate-800 pt-3 text-xs text-amber-200">建议：{item.action}</p></button>)}</div>
      </section>}

      {activeTab === 'growthExperiments' && growthMetrics && <section className="space-y-5">
        <div><h3 className="text-base font-bold">实验与 AI 洞察</h3><p className="mt-1 text-xs text-slate-400">管理增长实验并生成结构化经营洞察。</p></div>
        <div className="flex gap-2 border-b border-slate-800"><button onClick={() => setGrowthExperimentTab('experiments')} className={`px-3 py-2 text-sm ${growthExperimentTab === 'experiments' ? 'border-b-2 border-teal-400 text-white' : 'text-slate-400'}`}>增长实验中心</button><button onClick={() => setGrowthExperimentTab('ai')} className={`px-3 py-2 text-sm ${growthExperimentTab === 'ai' ? 'border-b-2 border-teal-400 text-white' : 'text-slate-400'}`}>AI 增长洞察</button></div>
        {growthExperimentTab === 'experiments' ? <><div className="flex justify-end"><button onClick={() => setShowExperimentForm(v => !v)} className="btn"><Plus className="h-4 w-4" />创建 Mock 实验</button></div>{showExperimentForm && <Card title="创建增长实验"><div className="grid gap-3 md:grid-cols-2">{Object.entries(experimentForm).map(([key, value]) => <input key={key} className="input" value={value} onChange={e => setExperimentForm({ ...experimentForm, [key]: e.target.value })} placeholder={({ name: '实验名称', segment: '目标人群', metric: '目标指标', hypothesis: '实验假设', groupA: 'A 组方案', groupB: 'B 组方案', duration: '实验周期', successCriteria: '成功标准' } as any)[key]} />)}</div><div className="mt-3 flex justify-end gap-2"><button className="btn" onClick={() => setShowExperimentForm(false)}>取消</button><button className="btn" onClick={createGrowthExperiment}>创建实验</button></div></Card>}<Card title="实验列表"><Table headers={['实验名称', '目标人群', '目标指标', '状态', '开始时间', '当前结果', '操作']}>{growthExperiments.map(exp => <tr key={exp.id}><Td>{exp.name}</Td><Td>{exp.segment}</Td><Td>{exp.metric}</Td><Td>{exp.status}</Td><Td>{exp.startDate}</Td><Td>{exp.result}</Td><Td><button className="mini" onClick={() => { setActionNotice(null); setSelectedGrowthExperiment(exp); }}>查看</button></Td></tr>)}</Table></Card></> : <><div className="flex flex-wrap gap-2"><button onClick={regenerateGrowthInsight} className="btn"><Sparkles className="h-4 w-4" />生成 AI 增长洞察</button><button onClick={regenerateGrowthInsight} className="btn"><RefreshCw className="h-4 w-4" />重新生成</button><button onClick={copyGrowthReport} className="btn"><Copy className="h-4 w-4" />复制报告</button><button onClick={exportGrowthReport} className="btn"><Download className="h-4 w-4" />导出报告</button><button onClick={generateTouchCopy} className="btn">生成触达文案</button></div><Card title="结构化 AI 增长洞察"><div className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{growthMetrics.copilotReport}</div></Card>{touchCopy && <Card title="触达文案"><div className="text-sm text-slate-300">{touchCopy}</div></Card>}</>}
      </section>}
    </main>

    {selectedAdminKyc && currentUser.role === UserRole.ADMIN && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-start justify-between gap-4"><div><h3 className="font-bold">KYC 详情</h3><p className="mt-1 text-xs text-slate-400">{selectedAdminKyc.username} / {selectedAdminKyc.role}</p></div><button className="btn" onClick={() => setSelectedAdminKyc(null)}>关闭</button></div>
        <div className="grid gap-x-6 md:grid-cols-2">
          <Row left="真实姓名" right={selectedAdminKyc.name || '-'} /><Row left="当前状态" right={adminKycStatusText(selectedAdminKyc)} />
          <Row left="证件类型" right={selectedAdminKyc.idType || '-'} /><Row left="证件号码" right={selectedAdminKyc.idNumber || '-'} />
          <Row left="出生日期" right={selectedAdminKyc.dob || '-'} /><Row left="国籍" right={selectedAdminKyc.nationality || '-'} />
          <Row left="证件到期时间" right={selectedAdminKyc.idDocumentExpiresAt || '系统账号'} /><Row left="认证通过时间" right={selectedAdminKyc.verifiedAt ? new Date(selectedAdminKyc.verifiedAt).toLocaleString() : '-'} />
          <Row left="提交时间" right={selectedAdminKyc.createdAt ? new Date(selectedAdminKyc.createdAt).toLocaleString() : '-'} /><Row left="更新时间" right={selectedAdminKyc.updatedAt ? new Date(selectedAdminKyc.updatedAt).toLocaleString() : '-'} />
        </div>
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-4"><div className="mb-2 text-xs font-bold text-slate-400">审核意见</div><div className="whitespace-pre-wrap text-sm">{selectedAdminKyc.auditorComments || '暂无审核意见'}</div></div>
      </div>
    </div>}

    {pendingKycAction && [UserRole.ADMIN, UserRole.RISK_ANALYST].includes(currentUser.role) && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="font-bold">确认{pendingKycAction.label}</h3>
        <p className="mt-2 text-sm text-slate-300">目标用户：{pendingKycAction.profile.username} / {pendingKycAction.profile.name}</p>
        <p className="mt-1 text-xs text-slate-500">状态将从 {adminKycStatusText(pendingKycAction.profile)} 更新为 {pendingKycAction.status === KYCStatus.INIT ? '等待重新提交' : cnKyc(pendingKycAction.status)}。</p>
        <div className="mt-4"><label className="label">{pendingKycAction.reasonRequired ? '操作原因（必填）' : '审核意见（选填）'}</label><textarea className="input min-h-28" value={kycActionReason} onChange={e => setKycActionReason(e.target.value)} placeholder={pendingKycAction.reasonRequired ? `请填写${pendingKycAction.label}原因` : '资料符合认证要求'} /></div>
        <div className="mt-5 flex justify-end gap-2"><button className="btn" onClick={() => { setPendingKycAction(null); setKycActionReason(''); }}>取消</button><button className={`btn ${pendingKycAction.status === KYCStatus.REJECTED || pendingKycAction.status === KYCStatus.INIT ? 'danger' : ''}`} disabled={pendingKycAction.reasonRequired && !kycActionReason.trim()} onClick={confirmKycAction}>确认{pendingKycAction.label}</button></div>
      </div>
    </div>}

    {selectedGrowthExperiment && currentUser.role === UserRole.GROWTH_ANALYST && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-start justify-between gap-4"><div><h3 className="font-bold">增长实验详情</h3><p className="mt-1 text-xs text-slate-400">{selectedGrowthExperiment.name}</p></div><button className="btn" onClick={() => setSelectedGrowthExperiment(null)}>关闭</button></div>
        <div className="grid gap-x-6 md:grid-cols-2">
          <Row left="目标人群" right={selectedGrowthExperiment.segment} />
          <Row left="目标指标" right={selectedGrowthExperiment.metric} />
          <Row left="当前状态" right={selectedGrowthExperiment.status} />
          <Row left="开始时间" right={selectedGrowthExperiment.startDate} />
          <Row left="实验周期" right={selectedGrowthExperiment.duration || '-'} />
          <Row left="当前结果" right={selectedGrowthExperiment.result} />
        </div>
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4"><div className="mb-2 text-xs font-bold text-slate-400">实验假设</div><div className="whitespace-pre-wrap text-sm text-slate-200">{selectedGrowthExperiment.hypothesis || '-'}</div></div>
          <div className="grid gap-3 md:grid-cols-2"><div className="rounded-lg border border-slate-800 bg-slate-950 p-4"><div className="mb-2 text-xs font-bold text-slate-400">A 组方案</div><div className="whitespace-pre-wrap text-sm text-slate-200">{selectedGrowthExperiment.groupA || '-'}</div></div><div className="rounded-lg border border-slate-800 bg-slate-950 p-4"><div className="mb-2 text-xs font-bold text-slate-400">B 组方案</div><div className="whitespace-pre-wrap text-sm text-slate-200">{selectedGrowthExperiment.groupB || '-'}</div></div></div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4"><div className="mb-2 text-xs font-bold text-slate-400">成功标准</div><div className="whitespace-pre-wrap text-sm text-slate-200">{selectedGrowthExperiment.successCriteria || '-'}</div></div>
        </div>
        <div className="mt-5 flex justify-end"><button className="btn" onClick={() => setSelectedGrowthExperiment(null)}>关闭</button></div>
      </div>
    </div>}

    {selectedAdminTransaction && currentUser.role === UserRole.ADMIN && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div><h3 className="font-bold">交易详情</h3><p className="mt-1 font-mono text-xs text-slate-400">{selectedAdminTransaction.id}</p></div>
          <button className="btn" onClick={() => setSelectedAdminTransaction(null)}>关闭</button>
        </div>
        <div className="grid gap-x-6 md:grid-cols-2">
          <Row left="申请时间" right={new Date(selectedAdminTransaction.createdAt).toLocaleString()} />
          <Row left="用户" right={selectedAdminTransaction.username || selectedAdminTransaction.userId} />
          <Row left="产品 / 资产" right={selectedAdminTransaction.assetType} />
          <Row left="交易金额" right={money(selectedAdminTransaction.amount)} />
          <Row left="当前状态" right={selectedAdminTransaction.status} />
          <Row left="余额扣减结果" right={selectedAdminTransaction.balanceDeducted ? '已扣减' : '未扣减'} />
          <Row left="处理人" right={selectedAdminTransaction.reviewedBy || '-'} />
          <Row left="处理时间" right={selectedAdminTransaction.reviewedAt ? new Date(selectedAdminTransaction.reviewedAt).toLocaleString() : '-'} />
        </div>
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4"><div className="mb-2 text-xs font-bold text-slate-400">系统判定 / 风控 reason</div><div className="whitespace-pre-wrap text-sm text-slate-200">{selectedAdminTransaction.reason || '-'}</div></div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4"><div className="mb-2 text-xs font-bold text-slate-400">Audit Detail</div><div className="whitespace-pre-wrap text-sm text-slate-200">{selectedAdminTransaction.auditDetail || '暂无人工终审记录'}</div></div>
        </div>
        <div className="mt-5 flex justify-end"><button className="btn" onClick={() => setSelectedAdminTransaction(null)}>关闭</button></div>
      </div>
    </div>}

    {selectedGrowthSegment && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"><div className="max-h-[85vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-5"><div className="mb-4 flex items-start justify-between gap-4"><div><h3 className="font-bold">{selectedGrowthSegment.name}</h3><p className="mt-1 text-xs text-slate-400">{selectedGrowthSegment.description}</p></div><button onClick={() => setSelectedGrowthSegment(null)} className="btn">关闭</button></div><Table headers={['脱敏用户名', '注册时间', 'KYC 状态', '入金金额', '最近活跃', '所属渠道', '建议动作']}>{(growthMetrics?.segmentDetails?.[selectedGrowthSegment.name] || []).map((user: any, index: number) => <tr key={`${user.username}-${index}`}><Td>{user.username}</Td><Td>{new Date(user.registeredAt).toLocaleString()}</Td><Td>{user.kycStatus}</Td><Td>{money(user.depositAmount)}</Td><Td>{new Date(user.lastActiveAt).toLocaleString()}</Td><Td>{user.channel}</Td><Td>{user.suggestedAction}</Td></tr>)}</Table></div></div>}

    {tradeModal.open && <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4"><div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4"><div className="flex justify-between"><h3 className="font-bold">交易申请</h3><button disabled={tradeModal.submitting} onClick={closeTrade} className="text-slate-400">关闭</button></div>{!tradeModal.result ? <div className="space-y-3"><Row left="产品名称" right={tradeModal.product?.name} /><Row left="产品风险等级" right={cnRisk(tradeModal.product?.riskLevel)} /><Row left="可用资金" right={money(currentUser.balance)} /><input className="input" value={tradeModal.amount} onChange={e => setTradeModal(p => ({ ...p, amount: e.target.value, error: '' }))} placeholder="交易金额" />{tradeModal.error && <div className="text-xs text-amber-300">{tradeModal.error}</div>}<button onClick={submitTrade} disabled={tradeModal.submitting} className="btn w-full">{tradeModal.submitting ? '提交中...' : '提交交易申请'}</button></div> : <div className="space-y-3"><div className="bg-slate-950 border border-slate-800 rounded p-4"><h4 className="font-bold">{tradeResultText(tradeModal.result.status).title}</h4><p className="text-sm text-slate-300 mt-2">{tradeResultText(tradeModal.result.status).desc}</p><p className="text-xs text-slate-500 mt-2">{sanitizeReason(tradeModal.result.reason, tradeModal.result.status)}</p></div>{tradeModal.error && <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">{tradeModal.error}</div>}{tradeModal.result.status === RiskDecision.STEP_UP && <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 text-xs text-amber-100">本次交易需要你确认。请确认这是你本人发起的交易，并确认继续提交。确认后，本次交易将通过并扣减账户余额。</div>}<Row left="当前状态" right={txStatusText(tradeModal.result.status)} /><Row left="产品名称" right={tradeModal.product?.name || tradeModal.result.assetType} /><Row left="交易金额" right={money(tradeModal.result.amount || tradeModal.amount)} /><Row left="交易编号" right={tradeModal.result.id || '-'} /><div className="flex justify-end gap-2">{tradeModal.result.status === RiskDecision.STEP_UP && <button disabled={tradeModal.submitting} onClick={confirmStepUp} className="btn">{tradeModal.submitting ? '确认中...' : '确认继续'}</button>}<button disabled={tradeModal.submitting} onClick={closeTrade} className="btn">关闭</button></div></div>}</div></div>}
  </div>;
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) { return <section className={`bg-slate-900 border border-slate-800 rounded-xl p-5 ${className}`}><h3 className="text-sm font-bold text-white mb-4">{title}</h3>{children}</section>; }
function Stat({ title, value }: { title: React.ReactNode; value: React.ReactNode }) { return <div className="bg-slate-950 border border-slate-800 rounded-lg p-4"><div className="text-[10px] text-slate-500 uppercase mb-1">{title}</div><div className="text-lg font-black text-white break-words">{value}</div></div>; }
function Row({ left, right }: { left: React.ReactNode; right: React.ReactNode }) { return <div className="flex justify-between gap-4 border-b border-slate-800/60 py-2 text-sm"><span className="text-slate-400">{left}</span><span className="text-slate-100 text-right">{right}</span></div>; }
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) { return <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="text-slate-400 border-b border-slate-800">{headers.map(h => <th key={h} className="p-2 whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-800/60">{children}</tbody></table></div>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="p-2 align-top max-w-xs break-words">{children}</td>; }
function Slider({ label, value, onChange, min = 0, max }: { label: string; value: number; min?: number; max: number; onChange: (v: number) => void }) { return <div><label className="label">{label}: {value} 次</label><input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full accent-teal-500" /></div>; }
function KycBadge({ status }: { status?: KYCStatus }) {
  const styles = status === KYCStatus.VERIFIED
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : status === KYCStatus.REJECTED
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
      : status === KYCStatus.MANUAL_REVIEW
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : 'border-sky-500/30 bg-sky-500/10 text-sky-300';
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${styles}`}>{status || KYCStatus.INIT}</span>;
}
