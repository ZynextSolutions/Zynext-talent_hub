import type { UserRole } from "@/types";

const ALL_ROLES: UserRole[] = ["EMPLOYEE", "MANAGER", "INSTRUCTOR", "ORG_ADMIN"];

export type ActorRole = UserRole | "SUPER_ADMIN";

export function formatRole(role: string): string {
  return role.replaceAll("_", " ");
}

/** Roles the signed-in user may assign when inviting or editing. */
export function assignableRoles(actorRole?: ActorRole | null): UserRole[] {
  if (actorRole === "ORG_ADMIN" || actorRole === "SUPER_ADMIN") return ALL_ROLES;
  if (actorRole === "MANAGER") return ["EMPLOYEE"];
  return [];
}

export function canAdministerUser(
  actorRole: ActorRole | undefined | null,
  targetRole: UserRole,
): boolean {
  if (actorRole === "ORG_ADMIN" || actorRole === "SUPER_ADMIN") return true;
  if (actorRole === "MANAGER") return targetRole === "EMPLOYEE";
  return false;
}
