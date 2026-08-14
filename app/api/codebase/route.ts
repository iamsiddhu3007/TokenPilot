import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { getSession } from "@/lib/session";

const SERVER = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";
const KEY = process.env.INTERNAL_API_KEY ?? "";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const membership = await prisma.projectMember.findUnique({
    where: { project_member_unique: { projectId, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "not a member" }, { status: 403 });

  try {
    const res = await fetch(`${SERVER}/api/codebase/${projectId}`, {
      headers: { "x-internal-key": KEY },
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: "Agent server not reachable" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { projectId } = await req.json();

  const membership = await prisma.projectMember.findUnique({
    where: { project_member_unique: { projectId, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "not a member" }, { status: 403 });

  try {
    const res = await fetch(`${SERVER}/api/codebase/${projectId}/summarize`, {
      method: "POST",
      headers: { "x-internal-key": KEY },
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: "Agent server not reachable" }, { status: 503 });
  }
}
