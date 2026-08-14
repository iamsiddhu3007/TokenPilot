"use client";

import { useActionState } from "react";
import { saveProviderConfig, type ActionState } from "@/app/(app)/actions";

const PROVIDERS = [
  { id: "anthropic", label: "Claude (Anthropic)" },
  { id: "openai", label: "ChatGPT (OpenAI)" },
  { id: "google", label: "Gemini (Google)" },
];

const NVIDIA_EMBED_MODELS = [
  { id: "nvidia/nv-embedqa-e5-v5", label: "nvidia/nv-embedqa-e5-v5" },
  { id: "baai/bge-m3", label: "baai/bge-m3" },
];

const field =
  "mt-1 w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40";

export function ProviderForm({
  projectId,
  provider,
  model,
  hasKey,
  nvidiaEmbedModel,
  hasNvidiaKey,
}: {
  projectId: string;
  provider?: string;
  model?: string;
  hasKey: boolean;
  nvidiaEmbedModel?: string;
  hasNvidiaKey?: boolean;
}) {
  const action = saveProviderConfig.bind(null, projectId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-3">
      <label className="block text-sm font-medium">
        Provider
        <select name="provider" defaultValue={provider ?? "anthropic"} className={field}>
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        Model <span className="font-normal text-foreground/50">(blank = provider default)</span>
        <input name="model" defaultValue={model ?? ""} placeholder="e.g. anthropic/claude-3-5-sonnet-20241022" className={field} />
      </label>

      <label className="block text-sm font-medium">
        Team API key{" "}
        {hasKey && <span className="font-normal text-green-600">✓ a key is saved</span>}
        <input
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder={hasKey ? "•••• paste to replace" : "paste the team's provider key"}
          className={field}
        />
      </label>

      <label className="block text-sm font-medium">
        NVIDIA API key{" "}
        {hasNvidiaKey && <span className="font-normal text-green-600">✓ a key is saved</span>}
        <input
          name="nvidiaApiKey"
          type="password"
          autoComplete="off"
          placeholder={hasNvidiaKey ? "•••• paste to replace" : "paste your NVIDIA API key (for embeddings)"}
          className={field}
        />
      </label>

      <label className="block text-sm font-medium">
        NVIDIA embedding model
        <select name="nvidiaEmbedModel" defaultValue={nvidiaEmbedModel ?? "nvidia/nv-embedqa-e5-v5"} className={field}>
          {NVIDIA_EMBED_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save provider"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-600">Saved — key encrypted at rest.</p>}
    </form>
  );
}
