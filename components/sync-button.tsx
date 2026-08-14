"use client";

import { useState } from "react";

export function SyncButton({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSync() {
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/pipeline/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json() as { synced?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "sync failed");
      setStatus("done");
      setMessage(`Queued ${data.synced} issue${data.synced === 1 ? "" : "s"}.`);
    } catch (e) {
      setStatus("error");
      setMessage((e as Error).message);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={status === "loading"}
        className="rounded-md border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
      >
        {status === "loading" ? "Syncing…" : "Sync issues"}
      </button>
      {message && (
        <span className={`text-sm ${status === "error" ? "text-red-600" : "text-foreground/60"}`}>
          {message}
        </span>
      )}
    </div>
  );
}
