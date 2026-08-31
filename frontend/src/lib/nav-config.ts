import type { LucideIcon } from "lucide-react";
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  Library,
  Megaphone,
  MessagesSquare,
  ScrollText,
  Search,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hide when user lacks any listed permission */
  permission?: string | string[];
  exact?: boolean;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const orgNavSections: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/catalog", label: "Catalog", icon: Search, permission: "course:read" },
      { href: "/community", label: "Community", icon: MessagesSquare, permission: "course:read" },
      { href: "/courses", label: "Courses", icon: BookOpen, permission: "course:read" },
      { href: "/learning-paths", label: "Learning paths", icon: GitBranch, permission: "course:read" },
    ],
  },
  {
    label: "Manage",
    items: [
      {
        href: "/organization",
        label: "Organization",
        icon: Building2,
        permission: ["org:read", "org:tree:read"],
      },
      {
        href: "/announcements",
        label: "Announcements",
        icon: Megaphone,
        permission: ["org:write", "course:write"],
      },
      { href: "/users", label: "Users", icon: Users, permission: "user:read" },
      { href: "/enrollments", label: "Enrollments", icon: GraduationCap, permission: "enrollment:read" },
      { href: "/question-banks", label: "Question banks", icon: Library, permission: "question-bank:write" },
      { href: "/grading", label: "Grading queue", icon: ClipboardCheck, permission: "assessment:grade" },
      { href: "/analytics", label: "Analytics", icon: BarChart3, permission: "analytics:read" },
      { href: "/reports", label: "Reports", icon: FileSpreadsheet, permission: ["reports:read", "reports:read:own"] },
      { href: "/skills", label: "Skills", icon: Sparkles, permission: "skills:read" },
      { href: "/settings/audit-logs", label: "Audit logs", icon: ScrollText, permission: "audit:read" },
      { href: "/certificates", label: "Certificates", icon: Award, permission: "certificate:read" },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

export function isNavActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function filterNavSections(
  sections: NavSection[],
  hasPermission: (permission: string) => boolean
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.permission) return true;
        const required = Array.isArray(item.permission) ? item.permission : [item.permission];
        return required.some((p) => hasPermission(p));
      }),
    }))
    .filter((section) => section.items.length > 0);
}
