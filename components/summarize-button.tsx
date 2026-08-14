"use client";

import { useState } from "react";

export function SummarizeButton({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function handle() {
    setStatus("loading");
    setMsg("");
    try {
      const res = await fetch("/api/codebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json() as { summarized?: number; total?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "failed");
      setStatus("done");
      setMsg(`Summarized ${data.summarized} of ${data.total} files.`);
      onDone();
    } catch (e) {
      setStatus("error");
      setMsg((e as Error).message);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handle}
        disabled={status === "loading"}
        className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
      >
        {status === "loading" ? "Summarizing… (may take a minute)" : "Summarize codebase"}
      </button>
      {msg && (
        <span className={`text-sm ${status === "error" ? "text-red-600" : "text-foreground/60"}`}>
          {msg}
        </span>
      )}
    </div>
  );
}
