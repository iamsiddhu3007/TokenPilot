import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getUserProjects } from "@/lib/queries";
import { NewProjectForm } from "@/components/new-project-form";

export default async function DashboardPage() {
  const session = await requireSession();
  const projects = await getUserProjects(session.user.id);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">New project</h2>
        <NewProjectForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your projects</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-foreground/60">
            No projects yet. Create one above to get started.
          </p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/10">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="rounded-full border border-black/10 px-2 py-0.5 text-xs text-foreground/60 dark:border-white/15">
                    {p.role}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
