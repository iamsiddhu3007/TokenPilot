import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/db/client";
import { requireSession } from "@/lib/session";
import { getProjectForUser } from "@/lib/queries";
import { ProviderForm } from "@/components/provider-form";
import { TestGatewayButton } from "@/components/test-gateway-button";
import { GithubUrlForm } from "@/components/github-url-form";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const data = await getProjectForUser(id, session.user.id);
  if (!data || data.role !== "manager") notFound();

  const cfg = await prisma.providerConfig.findUnique({ where: { projectId: id } });
  const gh = await prisma.githubConnection.findUnique({ where: { projectId: id } });

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link href={`/projects/${id}`} className="text-sm text-foreground/60 hover:underline">
          ← {data.project.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
      </div>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">AI provider</h2>
          <p className="text-sm text-foreground/60">
            Enter your Claude API key and NVIDIA API key. Keys are encrypted at rest and used only for this project.
          </p>
        </div>
        <ProviderForm
          projectId={id}
          model={cfg?.model}
          hasNvidiaKey={Boolean(cfg?.encNvidiaApiKey)}
          hasClaudeKey={Boolean(cfg?.encApiKey)}
          nvidiaEmbedModel={cfg?.nvidiaEmbedModel ?? "nvidia/nv-embedqa-e5-v5"}
        />
        {cfg && <TestGatewayButton projectId={id} />}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">GitHub repository</h2>
          <p className="text-sm text-foreground/60">
            Paste any GitHub repo URL. Public repos work without a token. For private repos, provide a Personal Access Token with <code>repo</code> scope.
          </p>
        </div>
        {gh?.owner && (
          <div className="rounded-lg border border-black/10 px-4 py-3 text-sm dark:border-white/10">
            Connected to{" "}
            <a
              href={`https://github.com/${gh.owner}/${gh.name}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium hover:underline"
            >
              {gh.owner}/{gh.name}
            </a>{" "}
            <span className="text-foreground/50">({gh.defaultBranch})</span>
          </div>
        )}
        <GithubUrlForm
          projectId={id}
          connected={gh?.owner ? { owner: gh.owner, name: gh.name!, defaultBranch: gh.defaultBranch! } : null}
        />
      </section>
    </div>
  );
}
