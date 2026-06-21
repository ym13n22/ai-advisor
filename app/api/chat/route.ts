import { NextResponse } from "next/server";
import { z } from "zod";
import { getDemoUserId } from "@/server/profileRepository";
import { handleUserMessage } from "@/server/chatService";

const schema = z.object({
  userId: z.string().optional(),
  conversationId: z.string().optional(),
  productId: z.string().nullable().optional(),
  text: z.string().min(1)
});

export async function POST(req: Request) {
  const parsed = schema.parse(await req.json());
  const userId = parsed.userId ?? (await getDemoUserId());
  return NextResponse.json(await handleUserMessage({ ...parsed, userId }));
}
