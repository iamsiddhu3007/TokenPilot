import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { requireSession } from "@/lib/session";
import { decrypt } from "@/lib/crypto";
import { chatCompletion } from "@/lib/llm";

export async function POST(req: Request) {
  const { projectId } = await req.json();
  const session = await requireSession();

  const membership = await prisma.projectMember.findUnique({
    where: { project_member_unique: { projectId, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "not a member" }, { status: 403 });

  const cfg = await prisma.providerConfig.findUnique({ where: { projectId } });
  if (!cfg) return NextResponse.json({ error: "no provider configured" }, { status: 400 });

  try {
    const result = await chatCompletion({
      model: cfg.model,
      apiKey: decrypt(cfg.encApiKey),
      messages: [{ role: "user", content: "Reply with one word: working" }],
      maxTokens: 10,
    });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
