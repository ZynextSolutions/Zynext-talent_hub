"use client";

import Link from "next/link";
import {
  Award,
  BookOpen,
  GraduationCap,
  TrendingUp,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { formatPercent } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EnrollmentAreaChart } from "@/components/charts/lazy-charts";

export function AdminDashboard() {
  const { user, organization } = useAuth();
  const { dashboard } = useAnalytics({ enabled: true });
  const { data, isLoading } = dashboard;

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="relative overflow-hidden bg-hero-gradient px-6 py-10">
        <div className="absolute inset-0 bg-gradient-radial from-indigo/15 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl space-y-4">
          <p className="text-muted-foreground text-sm font-medium">Welcome back</p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {user ? `${user.firstName}, here's your overview` : "Dashboard"}
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
            {organization?.name ?? "Your organization"} — track enrollments, completions, and team progress at a
            glance.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild>
              <Link href="/courses">
                <BookOpen className="mr-2 h-4 w-4" />
                Browse courses
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/analytics?tab=executive">View analytics</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))
          ) : (
            <>
              <Link href="/analytics?tab=learners" className="block">
                <StatCard
                  title="Active learners"
                  value={data?.kpis.lifetime.activeUserCount ?? 0}
                  description={`${data?.kpis.lifetime.userCount ?? 0} total users`}
                  icon={<Users className="h-5 w-5" />}
                />
              </Link>
              <Link href="/analytics?tab=learning" className="block">
                <StatCard
                  title="Enrollments"
                  value={data?.kpis.lifetime.enrollmentCount ?? 0}
                  description="Across all courses"
                  icon={<GraduationCap className="h-5 w-5" />}
                />
              </Link>
              <Link href="/analytics?tab=executive" className="block">
                <StatCard
                  title="Completion rate"
                  value={formatPercent(data?.kpis.lifetime.completionRate ?? 0)}
                  description="Organization average"
                  icon={<TrendingUp className="h-5 w-5" />}
                />
              </Link>
              <Link href="/analytics?tab=compliance" className="block">
                <StatCard
                  title="Certificates"
                  value={data?.kpis.lifetime.certificatesIssued ?? 0}
                  description="Issued to date"
                  icon={<Award className="h-5 w-5" />}
                />
              </Link>
            </>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3 shadow-luxury">
            <CardHeader>
              <CardTitle className="text-base">Enrollments over time</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <EnrollmentAreaChart data={data?.enrollmentsOverTime ?? []} />
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-luxury">
            <CardHeader>
              <CardTitle className="text-base">
                <Link href="/analytics?tab=learning" className="hover:underline">
                  Top courses
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))
              ) : data?.topCourses?.length ? (
                data.topCourses.slice(0, 5).map((course) => (
                  <div key={course.courseId} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{course.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {course.enrolled} enrolled · {course.completed} completed
                      </p>
                    </div>
                    <span className="text-indigo shrink-0 text-sm font-medium tabular-nums">
                      {formatPercent(course.completionRate)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No course data yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
