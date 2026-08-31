"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SidebarFooter } from "@/components/layout/sidebar-footer";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useAuth } from "@/hooks/useAuth";

export function Sidebar() {
  const { organization } = useAuth();

  return (
    <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
        <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo/15 ring-1 ring-indigo/25">
            <GraduationCap className="h-4 w-4 text-indigo" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Zynext TalentHub</p>
            <p className="text-muted-foreground truncate text-xs">{organization?.name ?? "Workspace"}</p>
          </div>
        </Link>
        <NotificationBell />
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <SidebarNav />
      </ScrollArea>

      <SidebarFooter className="shrink-0 border-t border-sidebar-border" />
    </aside>
  );
}
