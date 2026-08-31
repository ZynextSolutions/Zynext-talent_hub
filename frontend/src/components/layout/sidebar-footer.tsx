"use client";

import Link from "next/link";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { resolveAssetUrl } from "@/lib/certificate-template";

interface SidebarFooterProps {
  className?: string;
}

export function SidebarFooter({ className }: SidebarFooterProps) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className={cn("p-3 space-y-2", className)}>
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <Avatar className="h-8 w-8">
          {user?.avatarUrl ? (
            <AvatarImage src={resolveAssetUrl(user.avatarUrl)} alt="" />
          ) : null}
          <AvatarFallback className="bg-indigo/20 text-indigo text-xs">
            {user ? getInitials(user.firstName, user.lastName) : "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <Link href="/settings" className="block truncate text-sm font-medium hover:underline">
            {user ? `${user.firstName} ${user.lastName}` : "Guest"}
          </Link>
          <p className="text-muted-foreground truncate text-xs">{user?.email}</p>
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
