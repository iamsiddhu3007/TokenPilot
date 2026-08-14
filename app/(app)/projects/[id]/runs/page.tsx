import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getProjectForUser } from "@/lib/queries";
import { serverFetch } from "@/lib/agent-api";

type AgentRun = {
  id: string;
  agentType: string;
  langsmithRunId: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
};

type IssueWithRuns = {
  id: string;
  githubIssueNumber: number;
  title: string;
  status: string;
  agentRuns: AgentRun[];
};

const STATUS_COLORS: Record<string, string> = {
  success: "text-green-600",
  failed: "text-red-600",
  running: "text-yellow-600",
};

export default async function RunsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const data = await getProjectForUser(id, session.user.id);
  if (!data) notFound();

  let issues: IssueWithRuns[] = [];
  let fetchError: string | null = null;
  try {
    issues = await serverFetch<IssueWithRuns[]>(`/api/traces/${id}`);
  } catch {
    fetchError = "Agent server not reachable. Run: npm run server:dev";
  }

  const allRuns = issues.flatMap((iss) =>
    iss.agentRuns.map((r) => ({ ...r, issueNumber: iss.githubIssueNumber, issueTitle: iss.title })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/projects/${id}`} className="text-sm text-foreground/60 hover:underline">
          ← {data.project.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Agent Runs</h1>
      </div>

      {fetchError && (
        <p className="rounded-lg border border-dashed border-black/15 px-4 py-3 text-sm text-foreground/60 dark:border-white/20">
          {fetchError}
        </p>
      )}

      {!fetchError && allRuns.length === 0 && (
        <p className="text-sm text-foreground/60">No agent runs yet.</p>
      )}

      {allRuns.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 text-left">
                <th className="pb-2 pr-4 font-medium text-foreground/60">Issue</th>
                <th className="pb-2 pr-4 font-medium text-foreground/60">Agent</th>
                <th className="pb-2 pr-4 font-medium text-foreground/60">Status</th>
                <th className="pb-2 pr-4 font-medium text-foreground/60">Prompt tokens</th>
                <th className="pb-2 pr-4 font-medium text-foreground/60">Completion tokens</th>
                <th className="pb-2 pr-4 font-medium text-foreground/60">Cost USD</th>
                <th className="pb-2 font-medium text-foreground/60">LangSmith</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {allRuns.map((run) => {
                const durationMs =
                  run.finishedAt
                    ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
                    : null;
                return (
                  <tr key={run.id}>
                    <td className="py-3 pr-4 text-foreground/70">
                      #{run.issueNumber} {run.issueTitle.slice(0, 30)}{run.issueTitle.length > 30 ? "…" : ""}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">{run.agentType}</td>
                    <td className={`py-3 pr-4 font-medium ${STATUS_COLORS[run.status] ?? ""}`}>
                      {run.status}
                      {durationMs !== null && (
                        <span className="ml-1 text-foreground/40 font-normal">({(durationMs / 1000).toFixed(1)}s)</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right">{run.promptTokens ?? "—"}</td>
                    <td className="py-3 pr-4 text-right">{run.completionTokens ?? "—"}</td>
                    <td className="py-3 pr-4 text-right">
                      {run.costUsd != null ? `$${run.costUsd.toFixed(4)}` : "—"}
                    </td>
                    <td className="py-3">
                      {run.langsmithRunId ? (
                        <a
                          href={`https://smith.langchain.com/runs/${run.langsmithRunId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline text-xs"
                        >
                          view
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
