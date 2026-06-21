import { NextResponse } from "next/server";
import { z } from "zod";
import { recordTradeInteraction } from "@/server/tradeService";
import { getDemoUserId } from "@/server/profileRepository";

const schema = z.object({
  userId: z.string().optional(),
  conflictPairId: z.string(),
  action: z.enum(["撤回操作", "继续操作"])
});

export async function POST(req: Request) {
  const parsed = schema.parse(await req.json());
  const userId = parsed.userId ?? (await getDemoUserId());
  return NextResponse.json(await recordTradeInteraction({ ...parsed, userId }));
}
