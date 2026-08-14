"use client";

import { useActionState } from "react";
import { addMember, type ActionState } from "@/app/(app)/actions";

export function AddMemberForm({ projectId }: { projectId: string }) {
  const action = addMember.bind(null, projectId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        name="username"
        placeholder="username"
        required
        className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 sm:w-56 dark:border-white/15 dark:focus:border-white/40"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add member"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-600">Added.</p>}
    </form>
  );
}
