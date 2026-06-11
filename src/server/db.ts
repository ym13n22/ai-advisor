import fs from 'fs';
import path from 'path';
import { 
  User, 
  UserRole, 
  KYCProfile, 
  KYCStatus, 
  RiskScore, 
  RiskLevel, 
  RiskDecision, 
  Transaction, 
  BehaviorLog, 
  DepositRecord,
  InvestmentProduct 
} from '../types';

const DB_FILE = path.join(process.cwd(), 'database.json');

interface DbSchema {
  users: User[];
  kycProfiles: KYCProfile[];
  riskScores: RiskScore[];
  transactions: Transaction[];
  behaviorLogs: BehaviorLog[];
  depositRecords: DepositRecord[];
  products: InvestmentProduct[];
}

// Pre-seeded investment products
const DEFAULT_PRODUCTS: InvestmentProduct[] = [
  {
    id: 'prod_1',
    name: 'RiskMind 鑫享余 A 期货币基金 (RiskMind Money Fund)',
    riskLevel: 'LOW',
    expectedReturn: '2.84% - 3.25%',
    liquidity: 'T+0 即时赎回 (Instant Redeem)',
    assetType: '货币期权/存款 (Cash/Deposits)'
  },
  {
    id: 'prod_2',
    name: '智能智投信用债优选基金 (Smart Bond Fund)',
    riskLevel: 'LOW',
    expectedReturn: '4.50% - 5.20%',
    liquidity: 'T+1 赎回 (Daily Liquid)',
    assetType: '利率债/高信用企业债 (Credit Bonds)'
  },
  {
    id: 'prod_3',
    name: '全球科技轮动平衡组 A (Global Tech Balanced)',
    riskLevel: 'MEDIUM',
    expectedReturn: '8.50% - 12.00%',
    liquidity: 'T+3 赎回 (Weekly Liquid)',
    assetType: '股债混合型 (Balanced Portfolio)'
  },
  {
    id: 'prod_4',
    name: 'RiskMind 宏观趋势成长混合基金 (Macro Growth Mix)',
    riskLevel: 'MEDIUM',
    expectedReturn: '15.40% - 18.20%',
    liquidity: 'T+5 赎回 (Weekly Liquid)',
    assetType: '主动偏股混合型 (Active Equity Mix)'
  },
  {
    id: 'prod_5',
    name: '加密数币算力高频波段 A 基金 (Crypto Alpha Arbitrage)',
    riskLevel: 'HIGH',
    expectedReturn: '28.00% - 42.00%',
    liquidity: 'T+7 赎回 (Lock-up Multiplier)',
    assetType: '加密资产/高频衍生品 (Crypto Derivates)'
  },
  {
    id: 'prod_6',
    name: '科创成长杠杆进取 100 指数 (Tech Growth Leveraged Index)',
    riskLevel: 'HIGH',
    expectedReturn: '35.00% - 55.00%',
    liquidity: 'T+10 赎回 (Bi-weekly Liquid)',
    assetType: '衍生杠杆宽幅指数 (Leveraged Index)'
  }
];

class Database {
  private data: DbSchema = {
    users: [],
    kycProfiles: [],
    riskScores: [],
    transactions: [],
    behaviorLogs: [],
    depositRecords: [],
    products: []
  };

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(fileContent);
        // Ensure static structure
        if (!this.data.users) this.data.users = [];
        if (!this.data.kycProfiles) this.data.kycProfiles = [];
        if (!this.data.riskScores) this.data.riskScores = [];
        if (!this.data.transactions) this.data.transactions = [];
        if (!this.data.behaviorLogs) this.data.behaviorLogs = [];
        if (!this.data.depositRecords) this.data.depositRecords = [];
        let migrated = false;
        this.data.kycProfiles.forEach(profile => {
          if (profile.status === KYCStatus.VERIFIED && !profile.idDocumentExpiresAt) {
            profile.idDocumentExpiresAt = '2030-12-31';
            profile.lastVerifiedExpiresAt = '2030-12-31';
            migrated = true;
          }
        });
        if (!this.data.products || this.data.products.length === 0) {
          this.data.products = DEFAULT_PRODUCTS;
        }
        if (migrated) this.save();
      } else {
        this.data.products = DEFAULT_PRODUCTS;
        this.seed();
        this.save();
      }
    } catch (e) {
      console.error('Failed to load database. fallback to memory', e);
      this.data.products = DEFAULT_PRODUCTS;
      this.seed();
    }
  }

  public save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to sync write database file', e);
    }
  }

  private seed() {
    console.log('Seeding demo data for RiskMind AI Platform...');
    this.data.users = [
      {
        id: 'user_admin',
        username: 'admin',
        role: UserRole.ADMIN,
        createdAt: '2026-05-01T08:00:00Z',
        balance: 1000000,
        lastActiveAt: new Date().toISOString()
      },
      {
        id: 'user_risk_analyst',
        username: 'risk',
        role: UserRole.RISK_ANALYST,
        createdAt: '2026-05-02T09:00:00Z',
        balance: 50000,
        lastActiveAt: new Date().toISOString()
      },
      {
        id: 'user_growth_analyst',
        username: 'growth',
        role: UserRole.GROWTH_ANALYST,
        createdAt: '2026-05-03T10:00:00Z',
        balance: 20000,
        lastActiveAt: new Date().toISOString()
      },
      {
        id: 'user_trader_1',
        username: 'trader',
        role: UserRole.TRADER,
        createdAt: '2026-05-10T12:00:00Z',
        balance: 15450,
        lastActiveAt: new Date().toISOString(),
        firstDepositAt: '2026-05-10T14:30:00Z',
        firstTradeAt: '2026-05-10T15:00:00Z'
      },
      {
        id: 'user_trader_vip',
        username: 'vip_trader',
        role: UserRole.TRADER,
        createdAt: '2026-05-11T13:00:00Z',
        balance: 852000,
        lastActiveAt: new Date().toISOString(),
        firstDepositAt: '2026-05-11T13:45:00Z',
        firstTradeAt: '2026-05-11T14:30:00Z'
      }
    ];

    // Seed KYC profiles
    this.data.kycProfiles = [
      {
        id: 'kyc_admin_passed',
        userId: 'user_admin',
        name: '最高审计官林超 (Director Lin)',
        idNumber: '110108197701019999',
        dob: '1977-01-01',
        nationality: 'China',
        idType: '身份证 (National ID ID)',
        deviceInfo: 'Mozilla/5.0 AppleMacintosh M3 Max',
        ipAddress: '103.20.12.33',
        status: KYCStatus.VERIFIED,
        createdAt: '2026-05-01T08:00:00Z',
        updatedAt: '2026-05-01T08:30:00Z',
        idDocumentExpiresAt: '2032-01-01',
        verifiedAt: '2026-05-01T08:30:00Z',
        auditorComments: '主系统最高审计官免检特权通过 (Audit Director auto-bypassed and verified)'
      },
      {
        id: 'kyc_risk_pending',
        userId: 'user_risk_analyst',
        name: '风控组初级分析师王强 (Analyst Wang)',
        idNumber: '310115199205128888',
        dob: '1992-05-12',
        nationality: 'China',
        idType: '身份证 (National ID ID)',
        deviceInfo: 'Mozilla/5.0 Windows NT 11',
        ipAddress: '124.64.18.204',
        status: KYCStatus.PENDING,
        createdAt: '2026-05-02T09:15:00Z',
        updatedAt: '2026-05-02T09:15:00Z',
        idDocumentExpiresAt: '2030-05-12',
        auditorComments: '初级风控进件待内审。仅限审计主管(Admin)签批 (Awaiting review by Audit Director)'
      },
      {
        id: 'kyc_growth_pending',
        userId: 'user_growth_analyst',
        name: '增长渠道运营陈露 (Analyst Chen)',
        idNumber: '440106199508216666',
        dob: '1995-08-21',
        nationality: 'China',
        idType: '身份证 (National ID ID)',
        deviceInfo: 'Mozilla/5.0 MacOS 14.5 Sonoma',
        ipAddress: '218.17.158.42',
        status: KYCStatus.PENDING,
        createdAt: '2026-05-03T10:20:00Z',
        updatedAt: '2026-05-03T10:20:00Z',
        idDocumentExpiresAt: '2030-08-21',
        auditorComments: '初级增长运营进件待内审。仅限审计主管(Admin)签批 (Awaiting review by Audit Director)'
      },
      {
        id: 'kyc_trader_1',
        userId: 'user_trader_1',
        name: '张伟 (Wei Zhang)',
        idNumber: '110101199003072345',
        dob: '1990-03-07',
        nationality: 'China',
        idType: '身份证 (National ID ID)',
        deviceInfo: 'Mozilla/5.0 iPhone 14 Pro Max',
        ipAddress: '114.242.22.103',
        status: KYCStatus.PENDING,
        createdAt: '2026-05-10T12:30:00Z',
        updatedAt: '2026-05-10T12:30:00Z',
        idDocumentExpiresAt: '2030-03-07',
        auditorComments: '新提交申请，等待合规审核中 (Awaiting compliance review)'
      },
      {
        id: 'kyc_trader_vip',
        userId: 'user_trader_vip',
        name: '李建国 (Jianguo Li)',
        idNumber: '310101198511234567',
        dob: '1985-11-23',
        nationality: 'China',
        idType: '身份证 (National ID ID)',
        deviceInfo: 'Mozilla/5.0 AppleMacintosh M2',
        ipAddress: '222.73.4.152',
        status: KYCStatus.PENDING,
        createdAt: '2026-05-11T13:10:00Z',
        updatedAt: '2026-05-11T13:10:00Z',
        idDocumentExpiresAt: '2030-11-23',
        auditorComments: '新提交申请，等待合规审核中 (Awaiting compliance review)'
      }
    ];

    // Seed Risk Scores
    this.data.riskScores = [
      {
        id: 'score_trader_1',
        userId: 'user_trader_1',
        ipChanges: 1,
        deviceSwitches: 1,
        txFrequency: 3,
        blacklistHit: false,
        score: 85,
        level: RiskLevel.LOW,
        pd: 0.03,
        decision: RiskDecision.ALLOW,
        explanation: '该用户身份认证匹配，处于常驻IP归属地，网络评级高。风控系统建议ALLOW放行交易，无异常行为。',
        updatedAt: '2026-05-10T13:05:00Z'
      },
      {
        id: 'score_trader_vip',
        userId: 'user_trader_vip',
        ipChanges: 0,
        deviceSwitches: 0,
        txFrequency: 1,
        blacklistHit: false,
        score: 95,
        level: RiskLevel.LOW,
        pd: 0.005,
        decision: RiskDecision.ALLOW,
        explanation: '该VIP用户行为极度合规稳健。常驻上海地区高净值线路，IP与物理设备无频繁偏移，风险评级极其安稳。',
        updatedAt: '2026-05-11T13:25:00Z'
      }
    ];

    // Seed Transactions
    this.data.transactions = [
      {
        id: 'tx_seed_1',
        userId: 'user_trader_1',
        username: 'trader',
        amount: 2500,
        assetType: '稳健A期基金',
        status: RiskDecision.ALLOW,
        reason: '正常范围交易，符合其 LOW 风控等级',
        createdAt: '2026-05-10T15:30:00Z'
      },
      {
        id: 'tx_seed_2',
        userId: 'user_trader_vip',
        username: 'vip_trader',
        amount: 250000,
        assetType: '全球股市智能组',
        status: RiskDecision.ALLOW,
        reason: '正常范围交易，符合其极强财富支付实力和 LOW 风控评级',
        createdAt: '2026-05-11T14:40:00Z'
      }
    ];

    // Seed Audit and Behavior logs
    this.data.behaviorLogs = [
      {
        id: 'log_seed_1',
        userId: 'user_trader_1',
        username: 'trader',
        actionType: 'KYC_SUBMIT',
        timestamp: '2026-05-10T12:30:00Z',
        serviceName: 'KYCService',
        requestPayload: '{"name": "张伟", "idType": "身份证"}',
        responseResult: '{"status": "PENDING"}',
        riskFlag: false
      },
      {
        id: 'log_seed_2',
        userId: 'user_admin',
        username: 'admin',
        actionType: 'KYC_AUDIT',
        timestamp: '2026-05-10T13:00:00Z',
        serviceName: 'KYCService',
        requestPayload: '{"kycId": "kyc_trader_1", "status": "VERIFIED"}',
        responseResult: '{"success": true}',
        riskFlag: false
      },
      {
        id: 'log_seed_3',
        userId: 'user_trader_1',
        username: 'trader',
        actionType: 'APPLY_TRANSACTION',
        timestamp: '2026-05-10T15:30:00Z',
        serviceName: 'TradeControlService',
        requestPayload: '{"amount": 2500, "asset_type": "稳健A期基金"}',
        responseResult: '{"status": "ALLOW"}',
        riskFlag: false
      }
    ];
  }

  // Getters
  get getUsers(): User[] {
    return this.data.users;
  }

  get getKycProfiles(): KYCProfile[] {
    return this.data.kycProfiles;
  }

  get getRiskScores(): RiskScore[] {
    return this.data.riskScores;
  }

  get getTransactions(): Transaction[] {
    return this.data.transactions;
  }

  get getBehaviorLogs(): BehaviorLog[] {
    return this.data.behaviorLogs;
  }

  get getDepositRecords(): DepositRecord[] {
    return this.data.depositRecords;
  }

  get getProducts(): InvestmentProduct[] {
    return this.data.products;
  }

  // Setters
  addUser(user: User) {
    this.data.users.push(user);
    this.save();
  }

  addKycProfile(profile: KYCProfile) {
    // Check if user already has a profile and replace or add
    const index = this.data.kycProfiles.findIndex(p => p.userId === profile.userId);
    if (index >= 0) {
      this.data.kycProfiles[index] = profile;
    } else {
      this.data.kycProfiles.push(profile);
    }
    this.save();
  }

  addRiskScore(score: RiskScore) {
    const index = this.data.riskScores.findIndex(s => s.userId === score.userId);
    if (index >= 0) {
      this.data.riskScores[index] = score;
    } else {
      this.data.riskScores.push(score);
    }
    this.save();
  }

  addTransaction(tx: Transaction) {
    this.data.transactions.unshift(tx); // Newest first
    this.save();
  }

  addBehaviorLog(log: BehaviorLog) {
    this.data.behaviorLogs.unshift(log); // Newest first
    this.save();
  }

  addDepositRecord(record: DepositRecord) {
    this.data.depositRecords.unshift(record);
    this.save();
  }

  updateKycStatus(kycId: string, status: KYCStatus, comments: string) {
    const profile = this.data.kycProfiles.find(p => p.id === kycId);
    if (profile) {
      const now = new Date();
      profile.status = status;
      profile.auditorComments = comments;
      profile.updatedAt = now.toISOString();
      if (status === KYCStatus.VERIFIED) {
        profile.verifiedAt = now.toISOString();
        profile.resubmitted = false;
        profile.accessRetainedUntil = undefined;
        profile.lastVerifiedExpiresAt = profile.idDocumentExpiresAt;
      } else if (status === KYCStatus.REJECTED || status === KYCStatus.INIT) {
        profile.accessRetainedUntil = undefined;
        profile.lastVerifiedExpiresAt = undefined;
        profile.resubmitted = false;
      } else if (status === KYCStatus.MANUAL_REVIEW && profile.idDocumentExpiresAt) {
        const expired = new Date(`${profile.idDocumentExpiresAt}T23:59:59`).getTime() < Date.now();
        if (expired) {
          profile.accessRetainedUntil = undefined;
          profile.lastVerifiedExpiresAt = undefined;
        }
      }
      this.save();
      return profile;
    }
    return null;
  }

  updateUserStatus(userId: string, accountStatus: 'ACTIVE' | 'DISABLED') {
    const user = this.data.users.find(item => item.id === userId);
    if (!user) return null;
    user.accountStatus = accountStatus;
    this.save();
    return user;
  }

  resetDemoSection(section: string) {
    if (section === 'traderKyc') {
      this.data.kycProfiles = this.data.kycProfiles.filter(profile => {
        const user = this.data.users.find(item => item.id === profile.userId);
        return user?.role !== UserRole.TRADER;
      });
      this.data.riskScores = this.data.riskScores.filter(score => {
        const user = this.data.users.find(item => item.id === score.userId);
        return user?.role !== UserRole.TRADER;
      });
    } else if (section === 'traderBalances') {
      this.data.users.forEach(user => {
        if (user.role === UserRole.TRADER) user.balance = 0;
      });
    } else if (section === 'transactions') {
      this.data.transactions = [];
    } else if (section === 'deposits') {
      this.data.depositRecords = [];
    } else if (section === 'auditLogs') {
      this.data.behaviorLogs = [];
    } else {
      return false;
    }
    this.save();
    return true;
  }

  public reset() {
    this.data.users = [];
    this.data.kycProfiles = [];
    this.data.riskScores = [];
    this.data.transactions = [];
    this.data.behaviorLogs = [];
    this.data.depositRecords = [];
    this.data.products = [];
    this.seed();
    this.save();
  }
}

export const db = new Database();
export default db;
