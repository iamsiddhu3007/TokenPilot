"use client";

import { useActionState } from "react";
import { saveProviderConfig, type ActionState } from "@/app/(app)/actions";

const field =
  "mt-1 w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40";

export function ProviderForm({
  projectId,
  model,
  hasKey,
  nvidiaEmbedModel,
  hasNvidiaKey,
}: {
  projectId: string;
  model?: string;
  hasKey: boolean;
  nvidiaEmbedModel?: string;
  hasNvidiaKey?: boolean;
}) {
  const action = saveProviderConfig.bind(null, projectId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">

      {/* Claude */}
      <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <p className="text-sm font-semibold">Claude (LLM — priority routing + estimation)</p>

        <label className="block text-sm">
          Model
          <input
            name="model"
            defaultValue={model ?? "claude-sonnet-4-5"}
            placeholder="e.g. claude-opus-4-8, claude-sonnet-4-6, claude-haiku-4-5"
            className={field}
          />
        </label>

        <label className="block text-sm">
          API key{" "}
          {hasKey && <span className="text-green-600">✓ saved</span>}
          <input
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder={hasKey ? "•••• paste to replace" : "sk-ant-..."}
            className={field}
          />
        </label>
      </div>

      {/* NVIDIA */}
      <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <p className="text-sm font-semibold">NVIDIA (embeddings — code indexing)</p>
        <p className="text-xs text-foreground/50">
          Free tier at build.nvidia.com · API is OpenAI-compatible
        </p>

        <label className="block text-sm">
          Embedding model
          <input
            name="nvidiaEmbedModel"
            defaultValue={nvidiaEmbedModel ?? "nvidia/nv-embedqa-e5-v5"}
            placeholder="nvidia/nv-embedqa-e5-v5  or  baai/bge-m3"
            className={field}
          />
        </label>

        <label className="block text-sm">
          API key{" "}
          {hasNvidiaKey && <span className="text-green-600">✓ saved</span>}
          <input
            name="nvidiaApiKey"
            type="password"
            autoComplete="off"
            placeholder={hasNvidiaKey ? "•••• paste to replace" : "nvapi-..."}
            className={field}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-600">Saved — keys encrypted at rest.</p>}
    </form>
  );
}
