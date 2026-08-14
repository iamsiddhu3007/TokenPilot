import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const installationId = searchParams.get("installation_id");
  const projectId = searchParams.get("state");
  if (!installationId || !projectId) return NextResponse.redirect(new URL("/dashboard", req.url));

  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  await prisma.githubConnection.upsert({
    where: { projectId },
    create: { projectId, installationId },
    update: { installationId },
  });
  return NextResponse.redirect(new URL(`/projects/${projectId}/settings`, req.url));
}
