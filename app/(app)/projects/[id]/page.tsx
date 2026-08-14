import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getProjectForUser } from "@/lib/queries";
import { AddMemberForm } from "@/components/add-member-form";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const data = await getProjectForUser(id, session.user.id);
  if (!data) notFound();

  const isManager = data.role === "manager";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-foreground/60 hover:underline">
            ← Projects
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{data.project.name}</h1>
        </div>
        {isManager && (
          <Link
            href={`/projects/${id}/settings`}
            className="rounded-md border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            Settings
          </Link>
        )}
      </div>

      <nav className="flex gap-3 text-sm">
        <Link href={`/projects/${id}/board`} className="rounded-md border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">
          Issue Board
        </Link>
        <Link href={`/projects/${id}/runs`} className="rounded-md border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">
          Agent Runs
        </Link>
        <Link href={`/projects/${id}/costs`} className="rounded-md border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">
          Costs
        </Link>
      </nav>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Members</h2>
        <ul className="mb-4 divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/10">
          {data.members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="font-medium">@{m.username ?? m.name}</span>
                <span className="ml-2 text-sm text-foreground/50">{m.email}</span>
              </div>
              <span className="rounded-full border border-black/10 px-2 py-0.5 text-xs text-foreground/60 dark:border-white/15">
                {m.role}
              </span>
            </li>
          ))}
        </ul>
        {isManager ? (
          <AddMemberForm projectId={id} />
        ) : (
          <p className="text-sm text-foreground/60">Only a manager can add members.</p>
        )}
      </section>
    </div>
  );
}
