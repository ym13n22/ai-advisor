import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.complianceCheckLog.deleteMany();
  await prisma.profileUpdateLog.deleteMany();
  await prisma.profileUpdateProposal.deleteMany();
  await prisma.conflictInteraction.deleteMany();
  await prisma.conflictEvent.deleteMany();
  await prisma.profileRoutingLog.deleteMany();
  await prisma.recognitionResult.deleteMany();
  await prisma.aiCallLog.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.product.deleteMany();
  await prisma.investmentGoal.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({ data: { id: "demo-user-a", name: "用户 A" } });
  await prisma.userProfile.create({
    data: {
      userId: user.id,
      emergencyFund: 12000,
      monthlyNecessaryExpense: 6000,
      incomeStability: "不稳定",
      monthlyDebtPayment: 5000,
      monthlyAfterTaxIncome: 12000,
      otherAvailableFunds: 20000,
      earliestUseDate: new Date("2026-08-01"),
      goalUseDate: new Date("2031-06-01"),
      delayTolerance: "不可延后",
      interimFundingProbability: 80,
      maxLossAmount: 10000,
      maxLossRatio: 0.1,
      postLossFundingNeed: "短期使用",
      recoveryWaitMonths: 3,
      investmentYears: 2,
      productTypes: JSON.stringify(["货币基金", "债券基金"]),
      maxDrawdownExperience: "5%-10%",
      marketCycleExperience: "部分经历",
      selfDecisionLevel: "需要陪伴",
      companionType: "风险提醒",
      proactiveContactPreference: "重要节点触达"
    }
  });
  await prisma.investmentGoal.create({
    data: {
      userId: user.id,
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
    }
  });
  await prisma.conversation.create({ data: { id: "demo-conversation", userId: user.id, title: "AI 顾投演示会话" } });
  await prisma.product.createMany({
    data: [
      { id: "money-fund", name: "货币基金", productType: "现金管理", historicalMaxDrawdown: 0.01, hasLockup: false, lockupDays: 0, earliestRedeemDate: null, redeemArrivalDays: 1, riskLevel: "低", description: "低波动现金管理工具，适合短期流动性安排。" },
      { id: "bond-fund", name: "债券基金", productType: "债券", historicalMaxDrawdown: 0.07, hasLockup: false, lockupDays: 0, earliestRedeemDate: null, redeemArrivalDays: 2, riskLevel: "中低", description: "以债券资产为主，存在净值波动。" },
      { id: "index-fund", name: "指数基金", productType: "权益", historicalMaxDrawdown: 0.25, hasLockup: false, lockupDays: 0, earliestRedeemDate: null, redeemArrivalDays: 3, riskLevel: "中高", description: "跟踪宽基指数，适合较长期限。" },
      { id: "stock-fund", name: "高波动股票基金", productType: "权益", historicalMaxDrawdown: 0.45, hasLockup: false, lockupDays: 0, earliestRedeemDate: null, redeemArrivalDays: 7, riskLevel: "高", description: "权益仓位高，历史回撤较大。" },
      { id: "closed-wealth", name: "封闭理财", productType: "固收+", historicalMaxDrawdown: 0.08, hasLockup: true, lockupDays: 180, earliestRedeemDate: new Date("2026-12-20"), redeemArrivalDays: 3, riskLevel: "中", description: "存在 180 天封闭期，到期前无法赎回。" }
    ]
  });
}

main().finally(async () => prisma.$disconnect());
