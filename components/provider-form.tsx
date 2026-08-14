"use client";

import { useActionState } from "react";
import { saveProviderConfig, type ActionState } from "@/app/(app)/actions";

const field =
  "mt-1 w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40";

const FREE_LLM_MODELS = [
  "meta/llama-3.3-70b-instruct",
  "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  "mistralai/mistral-7b-instruct-v0.3",
  "google/gemma-3-27b-it",
];

export function ProviderForm({
  projectId,
  model,
  hasNvidiaKey,
  hasClaudeKey,
  nvidiaEmbedModel,
}: {
  projectId: string;
  model?: string;
  hasNvidiaKey: boolean;
  hasClaudeKey: boolean;
  nvidiaEmbedModel?: string;
}) {
  const action = saveProviderConfig.bind(null, projectId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">

      {/* NVIDIA — required */}
      <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <div>
          <p className="text-sm font-semibold">NVIDIA API key <span className="text-red-500">*</span></p>
          <p className="text-xs text-foreground/50">Free tier at build.nvidia.com — covers LLM + embeddings</p>
        </div>

        <label className="block text-sm">
          API key {hasNvidiaKey && <span className="text-green-600">✓ saved</span>}
          <input
            name="nvidiaApiKey"
            type="password"
            autoComplete="off"
            placeholder={hasNvidiaKey ? "•••• paste to replace" : "nvapi-..."}
            className={field}
          />
        </label>

        <label className="block text-sm">
          LLM model
          <input
            name="model"
            defaultValue={model ?? FREE_LLM_MODELS[0]}
            placeholder={FREE_LLM_MODELS[0]}
            className={field}
          />
          <span className="mt-1 block text-xs text-foreground/40">
            Free: {FREE_LLM_MODELS.join(" · ")}
          </span>
        </label>

        <label className="block text-sm">
          Embedding model
          <input
            name="nvidiaEmbedModel"
            defaultValue={nvidiaEmbedModel ?? "nvidia/nv-embedqa-e5-v5"}
            placeholder="nvidia/nv-embedqa-e5-v5"
            className={field}
          />
          <span className="mt-1 block text-xs text-foreground/40">
            Free: nvidia/nv-embedqa-e5-v5 · baai/bge-m3
          </span>
        </label>
      </div>

      {/* Claude — optional */}
      <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <div>
          <p className="text-sm font-semibold">Claude API key <span className="text-foreground/40 font-normal">(optional)</span></p>
          <p className="text-xs text-foreground/50">
            Only needed if you set the LLM model to a <code>claude-*</code> name above
          </p>
        </div>
        <label className="block text-sm">
          API key {hasClaudeKey && <span className="text-green-600">✓ saved</span>}
          <input
            name="claudeApiKey"
            type="password"
            autoComplete="off"
            placeholder={hasClaudeKey ? "•••• paste to replace" : "sk-ant-... (leave blank to use NVIDIA)"}
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
      {state?.ok && <p className="text-sm text-green-600">Saved.</p>}
    </form>
  );
}
