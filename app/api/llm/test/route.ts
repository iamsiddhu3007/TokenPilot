import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { requireSession } from "@/lib/session";
import { decrypt } from "@/lib/crypto";
import { testLLM } from "@/lib/llm";

export async function POST(req: Request) {
  const { projectId } = await req.json();
  const session = await requireSession();

  const membership = await prisma.projectMember.findUnique({
    where: { project_member_unique: { projectId, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "not a member" }, { status: 403 });

  const cfg = await prisma.providerConfig.findUnique({ where: { projectId } });
  if (!cfg) return NextResponse.json({ error: "no provider configured" }, { status: 400 });

  if (!cfg.encNvidiaApiKey) return NextResponse.json({ error: "NVIDIA API key not set" }, { status: 400 });

  try {
    const result = await testLLM({
      model: cfg.model,
      nvidiaApiKey: decrypt(cfg.encNvidiaApiKey),
      claudeApiKey: cfg.encApiKey ? decrypt(cfg.encApiKey) : null,
    });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
