import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { requireSession } from "@/lib/session";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const installationId = searchParams.get("installation_id");
  const projectId = searchParams.get("state");
  if (!installationId || !projectId) return NextResponse.redirect(new URL("/dashboard", req.url));

  await requireSession();
  await prisma.githubConnection.upsert({
    where: { projectId },
    create: { projectId, installationId },
    update: { installationId },
  });
  return NextResponse.redirect(new URL(`/projects/${projectId}/settings`, req.url));
}
