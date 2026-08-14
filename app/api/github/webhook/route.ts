import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/github";
import { prisma } from "@/db/client";

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(payload, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event") ?? "unknown";
  console.log(`[github webhook] event: ${event}`);

  if (event === "issues") {
    const parsed = JSON.parse(payload) as {
      action: string;
      issue: { number: number; title: string; body?: string };
      installation?: { id: number };
      repository?: { owner: { login: string }; name: string };
    };

    if (["opened", "edited", "reopened"].includes(parsed.action)) {
      const repoOwner = parsed.repository?.owner?.login;
      const repoName = parsed.repository?.name;

      // Find project by GitHub connection
      const gh = repoOwner && repoName
        ? await prisma.githubConnection.findFirst({ where: { owner: repoOwner, name: repoName } })
        : null;

      if (gh) {
        const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";
        fetch(`${serverUrl}/api/pipeline/trigger`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-key": process.env.INTERNAL_API_KEY ?? "",
          },
          body: JSON.stringify({
            projectId: gh.projectId,
            issueNumber: parsed.issue.number,
            title: parsed.issue.title,
            body: parsed.issue.body,
            installationId: parsed.installation?.id?.toString() ?? gh.installationId,
          }),
        }).catch((e) => console.error("[webhook] failed to trigger pipeline:", e));
      }
    }
  }

  return NextResponse.json({ ok: true, event });
}
