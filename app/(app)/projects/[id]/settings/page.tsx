import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/db/client";
import { requireSession } from "@/lib/session";
import { getProjectForUser } from "@/lib/queries";
import { githubConfigured, listInstallationRepos, type RepoOption } from "@/lib/github";
import { ProviderForm } from "@/components/provider-form";
import { TestGatewayButton } from "@/components/test-gateway-button";
import { RepoPicker } from "@/components/repo-picker";

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

  let repos: RepoOption[] = [];
  let repoError: string | null = null;
  if (gh?.installationId && !gh.owner && githubConfigured()) {
    try {
      repos = await listInstallationRepos(gh.installationId);
    } catch (e) {
      repoError = (e as Error).message;
    }
  }

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
          hasKey={Boolean(cfg)}
          nvidiaEmbedModel={cfg?.nvidiaEmbedModel ?? "nvidia/nv-embedqa-e5-v5"}
          hasNvidiaKey={Boolean(cfg?.encNvidiaApiKey)}
        />
        {cfg && <TestGatewayButton projectId={id} />}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">GitHub repository</h2>
          <p className="text-sm text-foreground/60">
            Connect the repo TokenPilot watches for issues.
          </p>
        </div>

        {gh?.owner ? (
          <div className="rounded-lg border border-black/10 px-4 py-3 text-sm dark:border-white/10">
            Connected to{" "}
            <span className="font-medium">{gh.owner}/{gh.name}</span>{" "}
            <span className="text-foreground/50">({gh.defaultBranch})</span>
          </div>
        ) : gh?.installationId ? (
          repoError ? (
            <p className="text-sm text-red-600">Couldn&apos;t list repos: {repoError}</p>
          ) : (
            <RepoPicker projectId={id} repos={repos} />
          )
        ) : githubConfigured() ? (
          <a
            href={`/api/github/install?projectId=${id}`}
            className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Connect GitHub
          </a>
        ) : (
          <p className="rounded-lg border border-dashed border-black/15 px-4 py-3 text-sm text-foreground/60 dark:border-white/20">
            GitHub App not configured. See PLAN.md for setup.
          </p>
        )}
      </section>
    </div>
  );
}
