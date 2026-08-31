"use client";

import Link from "next/link";
import { AlertCircle, BookOpen, CheckCircle2, Clock, Search } from "lucide-react";
import { AssignedNotStartedSection, DueSoonSection } from "@/components/learner/due-soon-section";
import { AnnouncementBannerStack } from "@/components/announcements/announcement-banner";
import { ContinueLearningSection } from "@/components/learner/continue-learning-section";
import { MyPathsSection } from "@/components/learner/my-paths-section";
import { RecentCertificatesSection } from "@/components/learner/recent-certificates-section";
import { StatCard } from "@/components/dashboard/stat-card";
import { useAuth } from "@/hooks/useAuth";
import { useLearnerHome } from "@/hooks/useLearnerHome";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function LearnerHome() {
  const { user, organization } = useAuth();
  const {
    continueLearning,
    assignedNotStarted,
    dueItems,
    paths,
    recentCertificates,
    stats,
    isLoading,
    isError,
    refetch,
  } = useLearnerHome();

  const primaryContinue = continueLearning[0];

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="relative overflow-hidden bg-hero-gradient px-6 py-10">
        <div className="absolute inset-0 bg-gradient-radial from-indigo/15 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl space-y-4">
          <p className="text-muted-foreground text-sm font-medium">My learning</p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {user ? `${user.firstName}, pick up where you left off` : "My learning"}
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
            {organization?.name ?? "Your organization"} — track assigned courses, due dates, and learning paths
            in one place.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            {primaryContinue ? (
              <Button asChild>
                <Link href={`/learn/${primaryContinue.courseId}`}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Continue {primaryContinue.course?.title ? `"${primaryContinue.course.title}"` : "course"}
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/catalog">
                  <Search className="mr-2 h-4 w-4" />
                  Browse catalog
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/catalog">Discover courses</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-8">
        <AnnouncementBannerStack />
        {isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            Could not load your learning data.{" "}
            <button type="button" className="text-indigo font-medium underline" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
          ) : (
            <>
              <StatCard
                title="In progress"
                value={stats.inProgressCount}
                description="Active enrollments"
                icon={<BookOpen className="h-5 w-5" />}
              />
              <StatCard
                title="Overdue"
                value={stats.overdueCount}
                description="Past due date"
                icon={<AlertCircle className="h-5 w-5" />}
              />
              <StatCard
                title="Due soon"
                value={stats.dueSoonCount}
                description="Within 7 days"
                icon={<Clock className="h-5 w-5" />}
              />
              <StatCard
                title="Completed"
                value={stats.completedCount}
                description="Courses finished"
                icon={<CheckCircle2 className="h-5 w-5" />}
              />
            </>
          )}
        </div>

        <ContinueLearningSection items={continueLearning} isLoading={isLoading} />
        <DueSoonSection items={dueItems} isLoading={isLoading} />
        <AssignedNotStartedSection items={assignedNotStarted} isLoading={isLoading} />
        <MyPathsSection items={paths} isLoading={isLoading} />
        <RecentCertificatesSection items={recentCertificates} isLoading={isLoading} />
      </div>
    </div>
  );
}
