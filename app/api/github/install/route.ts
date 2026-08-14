import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { githubConfigured, installUrl } from "@/lib/github";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  if (!githubConfigured()) {
    return NextResponse.json({ error: "GitHub App is not configured on the server" }, { status: 503 });
  }

  return NextResponse.redirect(installUrl(projectId));
}
