/**
 * RiskMind Core Types
 */

export enum UserRole {
  ADMIN = 'Admin',
  RISK_ANALYST = 'Risk Analyst',
  GROWTH_ANALYST = 'Growth Analyst',
  TRADER = 'Trader',
}

export enum KYCStatus {
  INIT = 'INIT',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum RiskDecision {
  ALLOW = 'ALLOW',
  REVIEW = 'REVIEW',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  BLOCK = 'BLOCK',
  STEP_UP = 'STEP_UP',
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  createdAt: string;
  balance: number;
  firstDepositAt?: string;
  firstTradeAt?: string;
  lastActiveAt?: string;
  accountStatus?: 'ACTIVE' | 'DISABLED';
}

export interface KYCProfile {
  id: string;
  userId: string;
  name: string;
  idNumber: string;
  dob: string;
  nationality: string;
  idType: string;
  deviceInfo: string;
  ipAddress: string;
  status: KYCStatus;
  createdAt: string;
  updatedAt: string;
  idDocumentExpiresAt: string;
  verifiedAt?: string;
  resubmitted?: boolean;
  accessRetainedUntil?: string;
  lastVerifiedExpiresAt?: string;
  tradingAccessActive?: boolean;
  tradingAccessExpiresAt?: string;
  auditorComments?: string;
}

export interface RiskScore {
  id: string;
  userId: string;
  ipChanges: number;
  deviceSwitches: number;
  txFrequency: number;
  blacklistHit: boolean;
  score: number; // 0-100
  level: RiskLevel;
  pd: number; // Probability of Default
  decision: RiskDecision;
  explanation: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  username?: string;
  amount: number;
  assetType: string;
  status: RiskDecision;
  reason: string;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  auditDetail?: string;
  balanceDeducted?: boolean;
}

export interface BehaviorLog {
  id: string;
  userId: string;
  username?: string;
  actionType: string;
  timestamp: string;
  serviceName: string;
  requestPayload: string;
  responseResult: string;
  riskFlag: boolean;
}

export interface DepositRecord {
  id: string;
  userId: string;
  amount: number;
  currency: 'CNY';
  paymentMethod: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  remark?: string;
  createdAt: string;
}

export interface InvestmentProduct {
  id: string;
  name: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  expectedReturn: string;
  liquidity: string;
  assetType: string;
  explanation?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}
