import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUserId, getProfilePayload } from "@/server/profileRepository";

export async function GET() {
  const userId = await getDemoUserId();
  return NextResponse.json(await getProfilePayload(userId));
}

export async function PUT(req: Request) {
  const body = await req.json();
  const userId = body.userId ?? (await getDemoUserId());
  const { goal, profile } = body;
  if (profile) await prisma.userProfile.update({ where: { userId }, data: profile });
  if (goal) {
    const first = await prisma.investmentGoal.findFirst({ where: { userId } });
    if (first) await prisma.investmentGoal.update({ where: { id: first.id }, data: goal });
  }
  return NextResponse.json(await getProfilePayload(userId));
}
