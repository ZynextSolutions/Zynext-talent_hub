"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Moon, Shield, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn, getInitials } from "@/lib/utils";
import { isNavActive } from "@/lib/nav-config";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Building2,
  LayoutDashboard,
  ScrollText,
} from "lucide-react";

const navItems = [
  { href: "/platform", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/platform/organizations", label: "Organizations", icon: Building2 },
  { href: "/platform/audit-logs", label: "Audit logs", icon: ScrollText },
];

function PlatformNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {navItems.map(({ href, label, icon: Icon, exact }) => {
        const active = isNavActive(pathname, href, exact);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-violet-500/15 text-violet-300 shadow-sm ring-1 ring-violet-500/20"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function PlatformFooter({ className }: { className?: string }) {
  const { platformAdmin, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className={cn("space-y-2 p-3", className)}>
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-violet-500/20 text-violet-300 text-xs">
            {platformAdmin ? getInitials(platformAdmin.firstName, platformAdmin.lastName) : "PA"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {platformAdmin ? `${platformAdmin.firstName} ${platformAdmin.lastName}` : "Admin"}
          </p>
          <p className="text-muted-foreground truncate text-xs">{platformAdmin?.email}</p>
        </div>
      </div>
      <Separator />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
        <Button variant="ghost" size="sm" className="flex-1 justify-start gap-2" onClick={() => logout()}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

function PlatformSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <ScrollArea className="flex-1 px-3 py-4">
        <PlatformNav onNavigate={onNavigate} />
      </ScrollArea>
      <PlatformFooter className="shrink-0 border-t border-sidebar-border" />
    </>
  );
}

export function PlatformMobileHeader() {
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/25">
                <Shield className="h-4 w-4 text-violet-400" />
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold">Platform Admin</p>
                <p className="text-muted-foreground truncate text-xs font-normal">Zynext TalentHub</p>
              </div>
            </SheetTitle>
          </SheetHeader>
          <PlatformSidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <Link href="/platform" className="flex min-w-0 flex-1 items-center gap-2">
        <Shield className="h-5 w-5 shrink-0 text-violet-400" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Platform Admin</p>
          <p className="text-muted-foreground truncate text-xs">Zynext TalentHub</p>
        </div>
      </Link>
    </header>
  );
}

export function PlatformSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
        <Link href="/platform" className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/25">
            <Shield className="h-4 w-4 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Platform Admin</p>
            <p className="text-muted-foreground truncate text-xs">Zynext TalentHub</p>
          </div>
        </Link>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <PlatformSidebarContent />
      </div>
    </aside>
  );
}
