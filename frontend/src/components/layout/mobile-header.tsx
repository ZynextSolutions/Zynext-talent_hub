"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SidebarFooter } from "@/components/layout/sidebar-footer";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useAuth } from "@/hooks/useAuth";

export function MobileHeader() {
  const { organization } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-[280px] flex-col p-0">
          <SheetHeader className="border-b border-border px-4 py-4 text-left">
            <SheetTitle className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo/15 ring-1 ring-indigo/25">
                <GraduationCap className="h-4 w-4 text-indigo" />
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold">Zynext TalentHub</p>
                <p className="text-muted-foreground truncate text-xs font-normal">
                  {organization?.name ?? "Workspace"}
                </p>
              </div>
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
          <SidebarFooter className="border-t border-border" />
        </SheetContent>
      </Sheet>

      <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2">
        <GraduationCap className="h-5 w-5 shrink-0 text-indigo" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Zynext TalentHub</p>
          <p className="text-muted-foreground truncate text-xs">{organization?.name ?? "Workspace"}</p>
        </div>
      </Link>
      <NotificationBell />
    </header>
  );
}
