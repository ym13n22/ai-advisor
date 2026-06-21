import { randomUUID } from "crypto";
import { evaluateConflicts } from "@/domain/conflicts/evaluateConflicts";
import type { RecognitionSnapshot } from "@/domain/conflicts/types";
import { getLlmProvider } from "@/lib/llm/provider";
import { prisma } from "@/lib/prisma";
import { getDerivedProfile } from "./profileRepository";

const json = (value: unknown) => JSON.stringify(value);

export async function checkTradeConflict(input: {
  userId: string;
  productId: string;
  operationType: "买入" | "卖出";
  amount: number;
}) {
  const requestId = randomUUID();
  const conflictPairId = randomUUID();
  const startedAt = Date.now();
  const [profile, product] = await Promise.all([
    getDerivedProfile(input.userId),
    prisma.product.findUnique({ where: { id: input.productId } })
  ]);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");

  const recognition: RecognitionSnapshot = {
    intent: input.operationType,
    emotion: "平静",
    executionStage: "即将执行",
    confidence: 1
  };
  const operation = {
    type: input.operationType,
    amount: input.amount,
    fundRatio: profile.currentPreparedAmount > 0 ? input.amount / profile.currentPreparedAmount : null
  };
  const conflicts = evaluateConflicts({ profile, product, recognition, operation });
  let clarification: { question: string } | null = null;

  if (conflicts.overallConflictLevel === "high" && conflicts.topConflict) {
    const provider = getLlmProvider();
    const clarifyStart = Date.now();
    clarification = await provider.generateClarification({
      conflictType: conflicts.topConflict.conflictType,
      reasons: conflicts.topConflict.reasons
    });
    await prisma.aiCallLog.create({
      data: {
        userId: input.userId,
        conversationId: null,
        requestId,
        version: "clarification-prompt-v1.0",
        callType: "trade_clarification",
        input: json(conflicts.topConflict),
        output: json(clarification),
        success: true,
        errorCode: null,
        latencyMs: Date.now() - clarifyStart
      }
    });
  }

  await prisma.conflictEvent.create({
    data: {
      userId: input.userId,
      conversationId: null,
      requestId,
      conflictPairId,
      version: "trade-conflict-rules-v1.0",
      input: json({ profile, product, recognition, operation, source: "trade_pre_submit" }),
      output: json({ ...conflicts, clarification }),
      success: true,
      errorCode: null,
      latencyMs: Date.now() - startedAt,
      overallConflictLevel: conflicts.overallConflictLevel,
      status: conflicts.overallConflictLevel === "none" || conflicts.overallConflictLevel === "low" ? "complete" : "pending_confirmation"
    }
  });

  return {
    requestId,
    conflictPairId,
    product,
    operation,
    conflicts,
    clarification,
    canSubmitDirectly: conflicts.overallConflictLevel === "none" || conflicts.overallConflictLevel === "low"
  };
}

export async function recordTradeInteraction(input: {
  userId: string;
  conflictPairId: string;
  action: "撤回操作" | "继续操作";
}) {
  const requestId = randomUUID();
  await prisma.conflictInteraction.create({
    data: {
      userId: input.userId,
      conversationId: null,
      requestId,
      conflictPairId: input.conflictPairId,
      action: input.action,
      version: "trade-interaction-v1.0",
      input: json(input),
      output: json({ recorded: true }),
      success: true,
      errorCode: null,
      latencyMs: 0
    }
  });
  return { recorded: true };
}
