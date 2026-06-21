import { NextResponse } from "next/server";
import { z } from "zod";
import { handleClarificationAnswer } from "@/server/chatService";
import { getDemoUserId } from "@/server/profileRepository";

const schema = z.object({
  userId: z.string().optional(),
  conversationId: z.string(),
  conflictPairId: z.string(),
  answer: z.string().min(1),
  productId: z.string().nullable().optional()
});

export async function POST(req: Request) {
  const parsed = schema.parse(await req.json());
  const userId = parsed.userId ?? (await getDemoUserId());
  return NextResponse.json(await handleClarificationAnswer({ ...parsed, userId }));
}
