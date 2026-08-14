import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getProjectForUser } from "@/lib/queries";
import { serverFetch } from "@/lib/agent-api";

type Estimate = { effortHours: number; confidence: number; rationale: string | null };
type IssueJob = {
  id: string;
  githubIssueNumber: number;
  title: string;
  priority: string | null;
  budgetTier: string | null;
  status: string;
  estimate: Estimate | null;
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-800",
};

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const data = await getProjectForUser(id, session.user.id);
  if (!data) notFound();

  let jobs: IssueJob[] = [];
  let fetchError: string | null = null;
  try {
    jobs = await serverFetch<IssueJob[]>(`/api/issues/${id}`);
  } catch {
    fetchError = "Agent server not reachable. Run: npm run server:dev";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/projects/${id}`} className="text-sm text-foreground/60 hover:underline">
            ← {data.project.name}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Issue Board</h1>
        </div>
      </div>

      {fetchError && (
        <p className="rounded-lg border border-dashed border-black/15 px-4 py-3 text-sm text-foreground/60 dark:border-white/20">
          {fetchError}
        </p>
      )}

      {!fetchError && jobs.length === 0 && (
        <p className="text-sm text-foreground/60">
          No issues yet. Connect a GitHub repo and open an issue to trigger the pipeline.
        </p>
      )}

      {jobs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 text-left">
                <th className="pb-2 pr-4 font-medium text-foreground/60">#</th>
                <th className="pb-2 pr-4 font-medium text-foreground/60">Title</th>
                <th className="pb-2 pr-4 font-medium text-foreground/60">Priority</th>
                <th className="pb-2 pr-4 font-medium text-foreground/60">Size</th>
                <th className="pb-2 pr-4 font-medium text-foreground/60">Est. hours</th>
                <th className="pb-2 font-medium text-foreground/60">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-black/2 dark:hover:bg-white/2">
                  <td className="py-3 pr-4 text-foreground/50">#{job.githubIssueNumber}</td>
                  <td className="py-3 pr-4 font-medium">{job.title}</td>
                  <td className="py-3 pr-4">
                    {job.priority ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[job.priority] ?? "bg-gray-100 text-gray-800"}`}>
                        {job.priority}
                      </span>
                    ) : (
                      <span className="text-foreground/40">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-foreground/70">{job.budgetTier ?? "—"}</td>
                  <td className="py-3 pr-4">
                    {job.estimate ? `${job.estimate.effortHours}h` : <span className="text-foreground/40">—</span>}
                  </td>
                  <td className="py-3">
                    {job.estimate ? `${Math.round(job.estimate.confidence * 100)}%` : <span className="text-foreground/40">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
