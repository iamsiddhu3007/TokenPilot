import crypto from "node:crypto";
import { App, Octokit } from "octokit";

export function githubConfigured(): boolean {
  return Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}

function getApp(): App {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = (process.env.GITHUB_APP_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  if (!appId || !privateKey) throw new Error("GitHub App is not configured");
  return new App({ appId, privateKey });
}

/** Octokit instance from a PAT, or unauthenticated for public repos. */
export function getOctokit(pat?: string | null): Octokit {
  return new Octokit({ auth: pat ?? undefined });
}

/** Parse a GitHub URL into { owner, name }. Returns null if invalid. */
export function parseGithubUrl(url: string): { owner: string; name: string } | null {
  const match = url.trim().match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
  if (!match) return null;
  return { owner: match[1], name: match[2].replace(/\.git$/, "") };
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

export function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET ?? "";
  if (!secret || !signature) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
