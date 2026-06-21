import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUserId } from "@/server/profileRepository";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const avg = (items: number[]) => (items.length ? Math.round(items.reduce((a, b) => a + b, 0) / items.length) : 0);
const p95 = (items: number[]) => {
  if (!items.length) return 0;
  const sorted = [...items].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
};

export async function GET() {
  const userId = await getDemoUserId();
  const [ai, recognition, conflicts, updates, compliance] = await Promise.all([
    prisma.aiCallLog.findMany({ where: { userId } }),
    prisma.recognitionResult.findMany({ where: { userId } }),
    prisma.conflictEvent.findMany({ where: { userId } }),
    prisma.profileUpdateLog.findMany({ where: { userId } }),
    prisma.complianceCheckLog.findMany({ where: { userId } })
  ]);
  const latencies = ai.map((item) => item.latencyMs);
  const conflictTriggered = conflicts.filter((item) => item.overallConflictLevel !== "none");
  return NextResponse.json({
    callSuccessRate: pct(ai.filter((item) => item.success).length, ai.length),
    jsonPassRate: pct(ai.filter((item) => item.success).length, ai.length),
    schemaPassRate: pct(ai.filter((item) => item.success).length, ai.length),
    avgLatencyMs: avg(latencies),
    p95LatencyMs: p95(latencies),
    avgTokens: 0,
    highConfidenceRate: pct(recognition.filter((item) => item.confidence >= 0.8).length, recognition.length),
    unknownRate: pct(recognition.filter((item) => item.intent === "unknown" || item.emotion === "unknown").length, recognition.length),
    conflictTriggerRate: pct(conflictTriggered.length, conflicts.length),
    mediumConflictRate: pct(conflicts.filter((item) => item.overallConflictLevel === "medium").length, conflictTriggered.length),
    highConflictRate: pct(conflicts.filter((item) => item.overallConflictLevel === "high").length, conflictTriggered.length),
    profileUpdateRate: pct(updates.filter((item) => item.success).length, updates.length),
    conflictMitigationRate: pct(updates.filter((item) => item.success).length, updates.length),
    conflictResolvedRate: pct(updates.filter((item) => (item.output as { reevaluated?: { overallConflictLevel?: string } })?.reevaluated?.overallConflictLevel === "none").length, updates.length),
    compliancePassRate: pct(compliance.filter((item) => item.success).length, compliance.length)
  });
}
