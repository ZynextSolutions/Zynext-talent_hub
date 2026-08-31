import type { OrgTree } from "@/types";

export type AssignTargetType = "ORGANIZATION" | "DIVISION" | "DEPARTMENT" | "TEAM" | "USER";

export type AssignTargetFilter = "all" | "org" | "teams" | "people";

export interface AssignTarget {
  type: AssignTargetType;
  id: string;
  label: string;
  shortLabel: string;
  path?: string;
  memberCount: number;
}

export function assignTargetKey(target: Pick<AssignTarget, "type" | "id">): string {
  return `${target.type}:${target.id}`;
}

export function parseAssignTargetKey(key: string): { type: AssignTargetType; id: string } | null {
  const sep = key.indexOf(":");
  if (sep <= 0) return null;
  const type = key.slice(0, sep) as AssignTargetType;
  const id = key.slice(sep + 1);
  if (!id) return null;
  return { type, id };
}

export function assignTargetTypeLabel(type: AssignTargetType): string {
  switch (type) {
    case "ORGANIZATION":
      return "Organization";
    case "DIVISION":
      return "Division";
    case "DEPARTMENT":
      return "Department";
    case "TEAM":
      return "Team";
    case "USER":
      return "Person";
    default:
      return type;
  }
}

function teamUserCount(team: OrgTree["divisions"][0]["departments"][0]["teams"][0]): number {
  return team.users?.length ?? 0;
}

function departmentUserCount(dept: OrgTree["divisions"][0]["departments"][0]): number {
  return dept.teams.reduce((sum, team) => sum + teamUserCount(team), 0);
}

function divisionUserCount(division: OrgTree["divisions"][0]): number {
  return division.departments.reduce((sum, dept) => sum + departmentUserCount(dept), 0);
}

function organizationUserCount(tree: OrgTree): number {
  let total = 0;
  for (const division of tree.divisions) total += divisionUserCount(division);
  for (const dept of tree.unassignedDepartments) total += departmentUserCount(dept);
  return total;
}

export function flattenAssignTargets(tree: OrgTree): AssignTarget[] {
  const targets: AssignTarget[] = [
    {
      type: "ORGANIZATION",
      id: tree.organization.id,
      label: `Organization: ${tree.organization.name}`,
      shortLabel: tree.organization.name,
      memberCount: organizationUserCount(tree),
    },
  ];

  const addDept = (dept: OrgTree["divisions"][0]["departments"][0], divisionName?: string) => {
    const deptLabel = divisionName ? `${divisionName} / ${dept.name}` : dept.name;
    targets.push({
      type: "DEPARTMENT",
      id: dept.id,
      label: `Department: ${deptLabel}`,
      shortLabel: dept.name,
      path: divisionName,
      memberCount: departmentUserCount(dept),
    });
    for (const team of dept.teams) {
      targets.push({
        type: "TEAM",
        id: team.id,
        label: `Team: ${deptLabel} / ${team.name}`,
        shortLabel: team.name,
        path: deptLabel,
        memberCount: teamUserCount(team),
      });
      for (const user of team.users ?? []) {
        const name = `${user.firstName} ${user.lastName}`.trim() || user.email;
        targets.push({
          type: "USER",
          id: user.id,
          label: `User: ${name} (${team.name})`,
          shortLabel: name,
          path: `${deptLabel} / ${team.name}`,
          memberCount: 1,
        });
      }
    }
  };

  for (const division of tree.divisions) {
    targets.push({
      type: "DIVISION",
      id: division.id,
      label: `Division: ${division.name}`,
      shortLabel: division.name,
      memberCount: divisionUserCount(division),
    });
    for (const dept of division.departments) {
      addDept(dept, division.name);
    }
  }

  for (const dept of tree.unassignedDepartments) {
    addDept(dept);
  }

  return targets;
}

export function filterAssignTargets(
  targets: AssignTarget[],
  options: {
    query?: string;
    filter?: AssignTargetFilter;
    excludeKeys?: Set<string>;
  },
): AssignTarget[] {
  const q = options.query?.trim().toLowerCase() ?? "";
  const filter = options.filter ?? "all";

  return targets.filter((target) => {
    const key = assignTargetKey(target);
    if (options.excludeKeys?.has(key)) return false;

    if (filter === "org" && !["ORGANIZATION", "DIVISION", "DEPARTMENT"].includes(target.type)) {
      return false;
    }
    if (filter === "teams" && target.type !== "TEAM") return false;
    if (filter === "people" && target.type !== "USER") return false;

    if (!q) return true;
    const haystack = [target.label, target.shortLabel, target.path, target.type]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function assignmentTargetLabel(
  tree: OrgTree | undefined,
  type: string,
  id: string,
): string {
  if (!tree) return `${type.replaceAll("_", " ")} ${id.slice(0, 8)}…`;
  const match = flattenAssignTargets(tree).find((target) => target.type === type && target.id === id);
  if (match) return match.label;
  return `${type.replaceAll("_", " ")} ${id.slice(0, 8)}…`;
}

export function assignmentTargetSummary(
  tree: OrgTree | undefined,
  type: string,
  id: string,
): { shortLabel: string; typeLabel: string; path?: string; memberCount?: number } {
  if (!tree) {
    return {
      shortLabel: id.slice(0, 8) + "…",
      typeLabel: type.replaceAll("_", " "),
    };
  }
  const match = flattenAssignTargets(tree).find((target) => target.type === type && target.id === id);
  if (!match) {
    return {
      shortLabel: id.slice(0, 8) + "…",
      typeLabel: type.replaceAll("_", " "),
    };
  }
  return {
    shortLabel: match.shortLabel,
    typeLabel: assignTargetTypeLabel(match.type),
    path: match.path,
    memberCount: match.memberCount,
  };
}
