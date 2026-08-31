"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PlatformMobileHeader, PlatformSidebar } from "@/components/platform/platform-sidebar";
import { useAuth } from "@/hooks/useAuth";

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const { isPlatformAdmin, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (isPlatformAdmin) return;
    router.replace(isAuthenticated ? "/dashboard" : "/platform/login");
  }, [isLoading, isPlatformAdmin, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <PlatformSidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <PlatformMobileHeader />
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
