import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getProjectForUser } from "@/lib/queries";
import { serverFetch } from "@/lib/agent-api";

type CostEntry = {
  count: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
};

export default async function CostsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const data = await getProjectForUser(id, session.user.id);
  if (!data) notFound();

  let costs: Record<string, CostEntry> = {};
  let fetchError: string | null = null;
  try {
    costs = await serverFetch<Record<string, CostEntry>>(`/api/costs/${id}`);
  } catch {
    fetchError = "Agent server not reachable. Run: npm run server:dev";
  }

  const entries = Object.entries(costs);
  const totalCost = entries.reduce((sum, [, v]) => sum + v.costUsd, 0);
  const totalRuns = entries.reduce((sum, [, v]) => sum + v.count, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/projects/${id}`} className="text-sm text-foreground/60 hover:underline">
          ← {data.project.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Cost Reconciliation</h1>
      </div>

      {fetchError && (
        <p className="rounded-lg border border-dashed border-black/15 px-4 py-3 text-sm text-foreground/60 dark:border-white/20">
          {fetchError}
        </p>
      )}

      {!fetchError && entries.length === 0 && (
        <p className="text-sm text-foreground/60">No agent runs yet — costs will appear here once the pipeline processes issues.</p>
      )}

      {entries.length > 0 && (
        <>
          <div className="flex gap-6">
            <div className="rounded-lg border border-black/10 dark:border-white/10 px-5 py-4">
              <p className="text-xs text-foreground/50 uppercase tracking-wide">Total cost</p>
              <p className="mt-1 text-2xl font-semibold">${totalCost.toFixed(4)}</p>
            </div>
            <div className="rounded-lg border border-black/10 dark:border-white/10 px-5 py-4">
              <p className="text-xs text-foreground/50 uppercase tracking-wide">Total runs</p>
              <p className="mt-1 text-2xl font-semibold">{totalRuns}</p>
            </div>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 text-left">
                <th className="pb-2 pr-4 font-medium text-foreground/60">Agent</th>
                <th className="pb-2 pr-4 font-medium text-foreground/60 text-right">Runs</th>
                <th className="pb-2 pr-4 font-medium text-foreground/60 text-right">Prompt tokens</th>
                <th className="pb-2 pr-4 font-medium text-foreground/60 text-right">Completion tokens</th>
                <th className="pb-2 font-medium text-foreground/60 text-right">Cost USD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {entries.map(([agentType, data]) => (
                <tr key={agentType}>
                  <td className="py-3 pr-4 font-mono text-xs">{agentType}</td>
                  <td className="py-3 pr-4 text-right">{data.count}</td>
                  <td className="py-3 pr-4 text-right">{data.promptTokens.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-right">{data.completionTokens.toLocaleString()}</td>
                  <td className="py-3 text-right">${data.costUsd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
