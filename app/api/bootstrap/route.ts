import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUserId, getProfilePayload } from "@/server/profileRepository";

export async function GET() {
  const userId = await getDemoUserId();
  const [payload, products, lastRecognition, lastAi, openConflict] = await Promise.all([
    getProfilePayload(userId),
    prisma.product.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.recognitionResult.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.aiCallLog.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.conflictEvent.findFirst({ where: { userId, status: "pending_confirmation" }, orderBy: { createdAt: "desc" } })
  ]);
  return NextResponse.json({ ...payload, products, lastRecognition, lastAi, openConflict });
}
