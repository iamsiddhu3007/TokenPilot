import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { projectId } = await req.json();

  const membership = await prisma.projectMember.findUnique({
    where: { project_member_unique: { projectId, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "not a member" }, { status: 403 });

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

  try {
    const res = await fetch(`${serverUrl}/api/sync/${projectId}`, {
      method: "POST",
      headers: { "x-internal-key": process.env.INTERNAL_API_KEY ?? "" },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Agent server not reachable — is npm run server:dev running?" }, { status: 503 });
  }
}
