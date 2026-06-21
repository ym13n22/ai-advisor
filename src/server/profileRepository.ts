import { prisma } from "@/lib/prisma";
import { deriveProfile } from "@/domain/profile/deriveProfile";
import type { BaseProfile, GoalProfile } from "@/domain/profile/types";

export async function getDemoUserId() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  return user?.id ?? "demo-user-a";
}

export async function getDerivedProfile(userId: string) {
  const [profile, goal] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.investmentGoal.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } })
  ]);
  if (!profile || !goal) throw new Error("PROFILE_NOT_FOUND");
  return deriveProfile(profile as unknown as BaseProfile, goal as unknown as GoalProfile);
}

export async function getProfilePayload(userId: string) {
  const [user, profile, goal] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.investmentGoal.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } })
  ]);
  if (!user || !profile || !goal) throw new Error("PROFILE_NOT_FOUND");
  return { user, profile, goal, derived: deriveProfile(profile as unknown as BaseProfile, goal as unknown as GoalProfile) };
}
