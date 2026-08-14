"use client";

import { useActionState } from "react";
import { connectRepo, type ActionState } from "@/app/(app)/actions";

const field =
  "mt-1 w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40";

export function GithubUrlForm({
  projectId,
  connected,
}: {
  projectId: string;
  connected?: { owner: string; name: string; defaultBranch: string } | null;
}) {
  const action = connectRepo.bind(null, projectId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-3">
      <label className="block text-sm">
        GitHub repository URL
        <input
          name="githubUrl"
          defaultValue={connected ? `https://github.com/${connected.owner}/${connected.name}` : ""}
          placeholder="https://github.com/owner/repo"
          className={field}
        />
      </label>

      <label className="block text-sm">
        Personal Access Token{" "}
        <span className="font-normal text-foreground/50">(only needed for private repos)</span>
        <input
          name="githubPat"
          type="password"
          autoComplete="off"
          placeholder="ghp_... (leave blank for public repos)"
          className={field}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Connecting…" : connected ? "Update repo" : "Connect repo"}
      </button>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-600">Connected.</p>}
    </form>
  );
}
