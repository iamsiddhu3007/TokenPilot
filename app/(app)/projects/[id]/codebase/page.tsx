"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SummarizeButton } from "@/components/summarize-button";

type FileEntry = {
  filePath: string;
  chunkCount: number;
  preview: string;
  summary: string | null;
};

type CodebaseData = {
  files: FileEntry[];
  totalFiles: number;
  summarized: number;
};

export default function CodebasePage() {
  const params = useParams();
  const id = String(params.id);

  const [data, setData] = useState<CodebaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/codebase?projectId=${id}`);
      const json = await res.json() as CodebaseData & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "failed");
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/projects/${id}`} className="text-sm text-foreground/60 hover:underline">
            ← Project
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Codebase Index</h1>
        </div>
        {data && (
          <p className="text-sm text-foreground/50">
            {data.totalFiles} files indexed · {data.summarized} summarized
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-dashed border-black/15 px-4 py-3 text-sm text-foreground/60">
          {error}
        </p>
      )}

      {data?.totalFiles === 0 && (
        <p className="text-sm text-foreground/60">
          No files indexed yet. Connect a GitHub repo, then click Sync Issues on the project page.
        </p>
      )}

      {data && data.totalFiles > 0 && (
        <>
          <SummarizeButton projectId={id} onDone={load} />

          <div className="flex flex-col divide-y divide-black/5 dark:divide-white/5 rounded-lg border border-black/10 dark:border-white/10">
            {data.files.map((file) => (
              <div key={file.filePath} className="flex flex-col gap-1 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-mono text-sm font-medium truncate">{file.filePath}</span>
                    {file.summary ? (
                      <span className="text-sm text-foreground/70">{file.summary}</span>
                    ) : (
                      <span className="text-sm text-foreground/40 italic">not summarized yet</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-foreground/40">{file.chunkCount} chunk{file.chunkCount !== 1 ? "s" : ""}</span>
                    <button
                      onClick={() => setExpanded(expanded === file.filePath ? null : file.filePath)}
                      className="text-xs text-foreground/50 hover:text-foreground underline"
                    >
                      {expanded === file.filePath ? "hide" : "preview"}
                    </button>
                  </div>
                </div>
                {expanded === file.filePath && (
                  <pre className="mt-2 overflow-x-auto rounded bg-black/5 dark:bg-white/5 p-3 text-xs leading-relaxed whitespace-pre-wrap break-words">
                    {file.preview}…
                  </pre>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
