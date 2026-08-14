import crypto from "node:crypto";
import { App } from "octokit";

export function githubConfigured(): boolean {
  return Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}

function getApp(): App {
  const appId = process.env.GITHUB_APP_ID;
  // Private keys are pasted into .env with literal \n; restore real newlines.
  const privateKey = (process.env.GITHUB_APP_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  if (!appId || !privateKey) throw new Error("GitHub App is not configured");
  return new App({ appId, privateKey });
}

/** Where the manager is sent to install the App on their repo. */
export function installUrl(state: string): string {
  const slug = process.env.GITHUB_APP_SLUG ?? "";
  return `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(state)}`;
}

export type RepoOption = {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
};

/** Repos the given installation can access. */
export async function listInstallationRepos(installationId: string): Promise<RepoOption[]> {
  const octokit = await getApp().getInstallationOctokit(Number(installationId));
  const res = await octokit.request("GET /installation/repositories", { per_page: 100 });
  return res.data.repositories.map((r) => ({
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    defaultBranch: r.default_branch,
  }));
}

/** Verify a GitHub webhook's X-Hub-Signature-256 (HMAC-SHA256) in constant time. */
export function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET ?? "";
  if (!secret || !signature) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
