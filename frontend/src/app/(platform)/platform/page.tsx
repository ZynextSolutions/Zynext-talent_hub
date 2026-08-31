"use client";

import { Building2, Shield, Users } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { usePlatformOrganizations } from "@/hooks/usePlatform";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlatformDashboardPage() {
  const { platformAdmin } = useAuth();
  const { data, isLoading } = usePlatformOrganizations({ page: 1 });

  const orgs = data?.items ?? [];
  const activeCount = orgs.filter((o) => o.status === "ACTIVE").length;
  const suspendedCount = orgs.filter((o) => o.status === "SUSPENDED").length;
  const totalUsers = orgs.reduce((sum, o) => sum + o.userCount, 0);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-950/80 via-background to-background px-6 py-10">
        <div className="absolute inset-0 bg-gradient-radial from-violet-500/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl space-y-4">
          <p className="text-muted-foreground text-sm font-medium">Platform console</p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {platformAdmin ? `Hello, ${platformAdmin.firstName}` : "Platform overview"}
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
            Manage tenants, monitor organization health, and review platform-wide audit activity.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : (
            <>
              <StatCard
                title="Organizations"
                value={orgs.length}
                description={`${activeCount} active`}
                icon={<Building2 className="h-5 w-5" />}
              />
              <StatCard
                title="Suspended"
                value={suspendedCount}
                description="Requires attention"
                icon={<Shield className="h-5 w-5" />}
              />
              <StatCard
                title="Total users"
                value={totalUsers}
                description="Across all tenants"
                icon={<Users className="h-5 w-5" />}
              />
              <StatCard
                title="Courses"
                value={orgs.reduce((sum, o) => sum + o.courseCount, 0)}
                description="Platform-wide"
                icon={<Building2 className="h-5 w-5" />}
              />
            </>
          )}
        </div>

        <Card className="shadow-luxury">
          <CardHeader>
            <CardTitle className="text-base">Recent organizations</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : orgs.length ? (
              <ul className="divide-y divide-border">
                {orgs.slice(0, 5).map((org) => (
                  <li key={org.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-muted-foreground text-xs">{org.slug}</p>
                    </div>
                    <div className="text-muted-foreground text-right text-xs">
                      <p>{org.userCount} users</p>
                      <p>{org.status ?? "ACTIVE"}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No organizations yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
