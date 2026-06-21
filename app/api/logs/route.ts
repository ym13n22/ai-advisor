import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUserId } from "@/server/profileRepository";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? (await getDemoUserId());
  const [ai, recognition, routing, conflicts, interactions, proposals, updates, compliance] = await Promise.all([
    prisma.aiCallLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.recognitionResult.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.profileRoutingLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.conflictEvent.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.conflictInteraction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.profileUpdateProposal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.profileUpdateLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.complianceCheckLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 })
  ]);
  return NextResponse.json({ ai, recognition, routing, conflicts, interactions, proposals, updates, compliance });
}
