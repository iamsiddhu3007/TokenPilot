"use client";

import { useState } from "react";

export function TestGatewayButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35_000);
    try {
      const res = await fetch("/api/llm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const j = await res.json() as { ok?: boolean; model?: string; reply?: string; error?: string };
      setResult({ ok: !!j.ok, msg: j.ok ? `${j.model}: "${j.reply}"` : (j.error ?? "unknown error") });
    } catch (e) {
      clearTimeout(timer);
      const msg = (e as Error).name === "AbortError"
        ? "Timed out after 35s — NVIDIA free tier can be slow on first call, try again"
        : (e as Error).message;
      setResult({ ok: false, msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={run}
        disabled={loading}
        className="self-start rounded-md border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
      >
        {loading ? "Testing… (may take up to 30s)" : "Test gateway"}
      </button>
      {result && (
        <p className={`text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>{result.msg}</p>
      )}
    </div>
  );
}
