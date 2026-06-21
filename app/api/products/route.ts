import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return NextResponse.json(await prisma.product.findMany({ orderBy: { createdAt: "asc" } }));
}

export async function POST(req: Request) {
  const body = await req.json();
  const product = await prisma.product.create({ data: body });
  return NextResponse.json(product);
}
