import { prisma } from "@/db/client";

export async function getUserProjects(userId: string) {
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    include: { project: true },
  });
  return memberships.map((m) => ({
    id: m.project.id,
    name: m.project.name,
    role: m.role,
    ownerId: m.project.ownerId,
    createdAt: m.project.createdAt,
  }));
}

export async function getProjectForUser(projectId: string, userId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: { project_member_unique: { projectId, userId } },
  });
  if (!membership) return null;

  const proj = await prisma.project.findUnique({ where: { id: projectId } });
  if (!proj) return null;

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: true },
  });

  return {
    project: proj,
    role: membership.role,
    members: members.map((m) => ({
      userId: m.userId,
      role: m.role,
      username: m.user.displayUsername,
      name: m.user.name,
      email: m.user.email,
    })),
  };
}
