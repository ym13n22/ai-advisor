import { randomUUID } from "crypto";
import { profileFieldMap } from "@/config/profileFields";
import { routeProfileFields } from "@/config/intentProfileRouting";
import { checkCompliance, safeAnswerTemplate } from "@/domain/compliance/checkCompliance";
import { evaluateConflicts } from "@/domain/conflicts/evaluateConflicts";
import type { RecognitionSnapshot } from "@/domain/conflicts/types";
import { getLlmProvider } from "@/lib/llm/provider";
import { prisma } from "@/lib/prisma";
import { getDerivedProfile } from "./profileRepository";

const logVersion = "audit-log-v1.0";
const json = (value: unknown) => JSON.stringify(value);

function normalizeRecognition(raw: RecognitionSnapshot) {
  if (raw.confidence >= 0.8) return raw;
  if (raw.confidence >= 0.6) return raw.intent === "买入" || raw.intent === "卖出" ? { ...raw, highConflictCap: true } : raw;
  return { intent: "unknown", emotion: "unknown", executionStage: "unknown", confidence: raw.confidence } as RecognitionSnapshot;
}

function inferOperation(text: string, recognition: RecognitionSnapshot, preparedAmount: number) {
  const all = /全部|所有|清仓|全仓/.test(text);
  const type = recognition.intent === "买入" || recognition.intent === "卖出" || recognition.intent === "调整" ? recognition.intent : "无操作";
  return { type, amount: all ? preparedAmount : null, fundRatio: all ? 1 : null } as const;
}

export async function handleUserMessage(input: { userId: string; conversationId?: string; productId?: string | null; text: string }) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const conversation = input.conversationId
    ? await prisma.conversation.findUnique({ where: { id: input.conversationId } })
    : await prisma.conversation.create({ data: { userId: input.userId, title: "AI 顾投会话" } });
  if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");

  await prisma.message.create({ data: { userId: input.userId, conversationId: conversation.id, role: "user", content: input.text } });
  const profile = await getDerivedProfile(input.userId);
  const product = input.productId ? await prisma.product.findUnique({ where: { id: input.productId } }) : null;
  const provider = getLlmProvider();

  const recognitionStart = Date.now();
  const rawRecognition = await provider.recognizeState({ text: input.text });
  await prisma.aiCallLog.create({ data: { userId: input.userId, conversationId: conversation.id, requestId, version: "state-prompt-v1.0", callType: "recognition", input: json({ text: input.text }), output: json(rawRecognition), success: true, errorCode: null, latencyMs: Date.now() - recognitionStart } });
  const recognition = normalizeRecognition(rawRecognition as RecognitionSnapshot);
  await prisma.recognitionResult.create({ data: { userId: input.userId, conversationId: conversation.id, requestId, version: logVersion, input: json({ text: input.text }), output: json(recognition), success: true, errorCode: null, latencyMs: Date.now() - recognitionStart, intent: recognition.intent, emotion: recognition.emotion, executionStage: recognition.executionStage, confidence: recognition.confidence } });

  const routingStart = Date.now();
  const routing = routeProfileFields(recognition.intent, profile);
  await prisma.profileRoutingLog.create({ data: { userId: input.userId, conversationId: conversation.id, requestId, version: logVersion, input: json({ intent: recognition.intent }), output: json(routing), success: true, errorCode: null, latencyMs: Date.now() - routingStart } });

  const operation = inferOperation(input.text, recognition, profile.currentPreparedAmount);
  const conflictStart = Date.now();
  const conflicts = evaluateConflicts({ profile, product, recognition, operation });
  const highCapped = rawRecognition.confidence < 0.8 && conflicts.overallConflictLevel === "high";
  const effectiveConflictLevel = highCapped ? "medium" : conflicts.overallConflictLevel;
  const conflictPairId = randomUUID();
  await prisma.conflictEvent.create({ data: { userId: input.userId, conversationId: conversation.id, requestId, conflictPairId, version: "conflict-rules-v1.0", input: json({ profile, product, recognition, operation }), output: json({ ...conflicts, overallConflictLevel: effectiveConflictLevel }), success: true, errorCode: null, latencyMs: Date.now() - conflictStart, overallConflictLevel: effectiveConflictLevel, status: effectiveConflictLevel === "none" ? "complete" : "pending_confirmation" } });

  let clarification: { question: string } | null = null;
  const responseMode = effectiveConflictLevel === "high" ? "informational_only" : "normal";
  if (effectiveConflictLevel === "high" && conflicts.topConflict) {
    const clarifyStart = Date.now();
    clarification = await provider.generateClarification({ conflictType: conflicts.topConflict.conflictType, reasons: conflicts.topConflict.reasons });
    await prisma.aiCallLog.create({ data: { userId: input.userId, conversationId: conversation.id, requestId, version: "clarification-prompt-v1.0", callType: "clarification", input: json(conflicts.topConflict), output: json(clarification), success: true, errorCode: null, latencyMs: Date.now() - clarifyStart } });
  }

  const answerStart = Date.now();
  let answer = await provider.generateAnswer({ text: input.text, responseMode, conflictSummary: conflicts.topConflict?.conflictType ?? null, productName: product?.name ?? null });
  await prisma.aiCallLog.create({ data: { userId: input.userId, conversationId: conversation.id, requestId, version: "answer-prompt-v1.0", callType: "answer", input: json({ text: input.text, responseMode }), output: json(answer), success: true, errorCode: null, latencyMs: Date.now() - answerStart } });
  const compliance = checkCompliance(answer.content);
  if (!compliance.passed) answer = { responseMode: "informational_only", content: safeAnswerTemplate };
  await prisma.complianceCheckLog.create({ data: { userId: input.userId, conversationId: conversation.id, requestId, version: "compliance-v1.0", input: json({ content: answer.content }), output: json(compliance), success: compliance.passed, errorCode: compliance.passed ? null : "COMPLIANCE_TEMPLATE_USED", latencyMs: 0 } });
  await prisma.message.create({ data: { userId: input.userId, conversationId: conversation.id, role: "assistant", content: answer.content, metadata: json({ requestId, conflicts, responseMode, clarification }) } });

  return { requestId, conversationId: conversation.id, recognition, routing, conflicts: { ...conflicts, overallConflictLevel: effectiveConflictLevel, conflictPairId }, responseMode, answer, clarification, latencyMs: Date.now() - startedAt };
}

export async function handleClarificationAnswer(input: { userId: string; conversationId: string; conflictPairId: string; answer: string; productId?: string | null }) {
  const requestId = randomUUID();
  const provider = getLlmProvider();
  const profile = await getDerivedProfile(input.userId);
  const startedAt = Date.now();
  const proposal = await provider.extractProfileUpdate({ answer: input.answer, currentProfile: profile as unknown as Record<string, unknown> });
  await prisma.profileUpdateProposal.create({ data: { userId: input.userId, conversationId: input.conversationId, requestId, conflictPairId: input.conflictPairId, version: "profile-update-prompt-v1.0", input: json({ answer: input.answer }), output: json(proposal), success: true, errorCode: null, latencyMs: Date.now() - startedAt } });

  const field = proposal.targetUserField ? profileFieldMap[proposal.targetUserField] : null;
  const current = proposal.targetUserField ? (profile as unknown as Record<string, unknown>)[proposal.targetUserField] : null;
  const validation = {
    allowed: !!field?.updatable,
    currentMatches: JSON.stringify(current) === JSON.stringify(proposal.currentValue),
    schemaValid: field ? field.schema.safeParse(proposal.newValue).success : false,
    changed: JSON.stringify(current) !== JSON.stringify(proposal.newValue)
  };
  const canUpdate = proposal.updateRequired && proposal.status === "confirmed" && proposal.confidence >= 0.8 && !!field && validation.allowed && validation.currentMatches && validation.schemaValid && validation.changed;
  let updated = false;
  if (canUpdate && proposal.targetUserField) {
    await prisma.userProfile.update({ where: { userId: input.userId }, data: { [proposal.targetUserField]: proposal.newValue } });
    updated = true;
  }
  const newProfile = await getDerivedProfile(input.userId);
  const product = input.productId ? await prisma.product.findUnique({ where: { id: input.productId } }) : null;
  const reevaluated = evaluateConflicts({ profile: newProfile, product, recognition: { intent: "调整", emotion: "平静", executionStage: "考虑中", confidence: 1 }, operation: { type: "调整", amount: null, fundRatio: null } });
  await prisma.profileUpdateLog.create({ data: { userId: input.userId, conversationId: input.conversationId, requestId, conflictPairId: input.conflictPairId, version: logVersion, input: json({ proposal, before: profile }), output: json({ validation, updated, after: newProfile, reevaluated }), success: updated, errorCode: updated ? null : "PROFILE_UPDATE_SKIPPED", latencyMs: Date.now() - startedAt } });
  return { proposal, validation, updated, reevaluated };
}
