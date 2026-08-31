import type { NodeType, OrgTree, UserRole } from "@/types";

export interface OrgChartNode {
  id: string;
  name: string;
  type: NodeType;
  email?: string;
  role?: UserRole;
  subtitle?: string;
  children: OrgChartNode[];
}

function mapTeam(team: OrgTree["divisions"][0]["departments"][0]["teams"][0]): OrgChartNode {
  return {
    id: team.id,
    name: team.name,
    type: "TEAM",
    subtitle: `${team.users.length} member${team.users.length === 1 ? "" : "s"}`,
    children: team.users.map((user) => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      type: "USER",
      email: user.email,
      role: user.role,
      subtitle: user.role.replace("_", " "),
      children: [],
    })),
  };
}

function mapDepartment(dept: OrgTree["divisions"][0]["departments"][0]): OrgChartNode {
  return {
    id: dept.id,
    name: dept.name,
    type: "DEPARTMENT",
    subtitle: "Department",
    children: dept.teams.map(mapTeam),
  };
}

export function buildOrgChartTree(tree: OrgTree): OrgChartNode {
  const root: OrgChartNode = {
    id: tree.organization.id,
    name: tree.organization.name,
    type: "ORGANIZATION",
    subtitle: "Organization",
    children: [],
  };

  for (const division of tree.divisions) {
    root.children.push({
      id: division.id,
      name: division.name,
      type: "DIVISION",
      subtitle: "Division",
      children: division.departments.map(mapDepartment),
    });
  }

  for (const dept of tree.unassignedDepartments) {
    root.children.push(mapDepartment(dept));
  }

  return root;
}

export function countOrgChartNodes(node: OrgChartNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countOrgChartNodes(child), 0);
}
