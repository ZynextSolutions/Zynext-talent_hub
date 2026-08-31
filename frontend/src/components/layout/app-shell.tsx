"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { useAuth } from "@/hooks/useAuth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isPlatformAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (isPlatformAdmin) {
      router.replace("/platform");
    }
  }, [isLoading, isAuthenticated, isPlatformAdmin, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-indigo" />
      </div>
    );
  }

  if (!isAuthenticated || isPlatformAdmin) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
