"use client";

import { useActionState } from "react";
import { createProject, type ActionState } from "@/app/(app)/actions";

export function NewProjectForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createProject, null);
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        name="name"
        placeholder="New project name"
        required
        className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 sm:w-64 dark:border-white/15 dark:focus:border-white/40"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create project"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
