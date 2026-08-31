"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { filterNavSections, isNavActive, orgNavSections, type NavSection } from "@/lib/nav-config";
import { useAuth } from "@/hooks/useAuth";

interface SidebarNavProps {
  sections?: NavSection[];
  onNavigate?: () => void;
  activeClassName?: string;
}

export function SidebarNav({
  sections = orgNavSections,
  onNavigate,
  activeClassName = "bg-indigo/15 text-indigo shadow-sm ring-1 ring-indigo/20",
}: SidebarNavProps) {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const visible = filterNavSections(sections, hasPermission);

  return (
    <nav className="space-y-6">
      {visible.map((section, idx) => (
        <div key={section.label ?? idx} className="space-y-1">
          {section.label && (
            <p className="text-muted-foreground px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider">
              {section.label}
            </p>
          )}
          {section.items.map(({ href, label, icon: Icon, exact }) => {
            const active = isNavActive(pathname, href, exact);
            const displayLabel =
              href === "/dashboard" && !hasPermission("analytics:read") ? "My learning" : label;
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? activeClassName
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {displayLabel}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
