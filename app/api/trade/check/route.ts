import { NextResponse } from "next/server";
import { z } from "zod";
import { checkTradeConflict } from "@/server/tradeService";
import { getDemoUserId } from "@/server/profileRepository";

const schema = z.object({
  userId: z.string().optional(),
  productId: z.string(),
  operationType: z.enum(["买入", "卖出"]),
  amount: z.number().positive()
});

export async function POST(req: Request) {
  const parsed = schema.parse(await req.json());
  const userId = parsed.userId ?? (await getDemoUserId());
  return NextResponse.json(await checkTradeConflict({ ...parsed, userId }));
}
