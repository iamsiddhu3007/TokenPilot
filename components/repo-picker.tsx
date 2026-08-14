"use client";

import { useActionState } from "react";
import { connectRepo, type ActionState } from "@/app/(app)/actions";
import type { RepoOption } from "@/lib/github";

export function RepoPicker({ projectId, repos }: { projectId: string; repos: RepoOption[] }) {
  const action = connectRepo.bind(null, projectId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);

  if (repos.length === 0) {
    return (
      <p className="text-sm text-foreground/60">
        The App is installed but can&apos;t see any repos. Grant it access to a repo on GitHub, then refresh.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <select
        name="repo"
        defaultValue={`${repos[0].owner}|${repos[0].name}|${repos[0].defaultBranch}`}
        className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
      >
        {repos.map((r) => (
          <option key={r.fullName} value={`${r.owner}|${r.name}|${r.defaultBranch}`}>
            {r.fullName}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Connecting…" : "Connect repo"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
