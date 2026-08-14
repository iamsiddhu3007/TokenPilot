"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/db/client";
import { requireSession } from "@/lib/session";
import { encrypt } from "@/lib/crypto";
import { DEFAULT_CLAUDE_MODEL } from "@/lib/llm";
import { parseGithubUrl, getOctokit } from "@/lib/github";

export type ActionState = { error?: string; ok?: boolean } | null;

async function isManager(projectId: string, userId: string): Promise<boolean> {
  const m = await prisma.projectMember.findUnique({
    where: { project_member_unique: { projectId, userId } },
  });
  return m?.role === "manager";
}

export async function createProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Project name is required" };

  const proj = await prisma.project.create({
    data: {
      name,
      ownerId: session.user.id,
      members: { create: { userId: session.user.id, role: "manager" } },
    },
  });
  redirect(`/projects/${proj.id}`);
}

export async function addMember(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!(await isManager(projectId, session.user.id))) {
    return { error: "Only a manager can add members" };
  }

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  if (!username) return { error: "Username is required" };

  const target = await prisma.user.findUnique({ where: { username } });
  if (!target) return { error: `No user with username "${username}"` };

  const exists = await prisma.projectMember.findUnique({
    where: { project_member_unique: { projectId, userId: target.id } },
  });
  if (exists) return { error: "That user is already a member" };

  await prisma.projectMember.create({ data: { projectId, userId: target.id, role: "member" } });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function saveProviderConfig(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!(await isManager(projectId, session.user.id))) {
    return { error: "Only a manager can set the provider" };
  }

  const provider = "anthropic";
  const model = String(formData.get("model") ?? "").trim() || DEFAULT_CLAUDE_MODEL;
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  if (!apiKey) return { error: "Claude API key is required" };

  const nvidiaApiKey = String(formData.get("nvidiaApiKey") ?? "").trim();
  const nvidiaEmbedModel = String(formData.get("nvidiaEmbedModel") ?? "nvidia/nv-embedqa-e5-v5").trim();

  const encApiKey = encrypt(apiKey);
  const encNvidiaApiKey = nvidiaApiKey ? encrypt(nvidiaApiKey) : undefined;

  await prisma.providerConfig.upsert({
    where: { projectId },
    create: {
      projectId,
      provider,
      model,
      encApiKey,
      encNvidiaApiKey: encNvidiaApiKey ?? null,
      nvidiaEmbedModel,
    },
    update: {
      provider,
      model,
      encApiKey,
      ...(encNvidiaApiKey && { encNvidiaApiKey }),
      nvidiaEmbedModel,
    },
  });

  revalidatePath(`/projects/${projectId}/settings`);
  return { ok: true };
}

export async function connectRepo(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!(await isManager(projectId, session.user.id))) {
    return { error: "Only a manager can connect a repo" };
  }

  const url = String(formData.get("githubUrl") ?? "").trim();
  const parsed = parseGithubUrl(url);
  if (!parsed) return { error: "Enter a valid GitHub URL (e.g. https://github.com/owner/repo)" };

  const pat = String(formData.get("githubPat") ?? "").trim();

  // Verify the repo is accessible
  try {
    const octokit = getOctokit(pat || null);
    const { data: repo } = await octokit.request("GET /repos/{owner}/{repo}", {
      owner: parsed.owner,
      repo: parsed.name,
    });

    const encGithubPat = pat ? encrypt(pat) : null;

    await prisma.githubConnection.upsert({
      where: { projectId },
      create: {
        projectId,
        owner: parsed.owner,
        name: parsed.name,
        defaultBranch: repo.default_branch,
        encGithubPat,
      },
      update: {
        owner: parsed.owner,
        name: parsed.name,
        defaultBranch: repo.default_branch,
        ...(encGithubPat && { encGithubPat }),
      },
    });
  } catch {
    return { error: "Could not access that repo. For private repos, provide a Personal Access Token." };
  }

  revalidatePath(`/projects/${projectId}/settings`);
  return { ok: true };
}
