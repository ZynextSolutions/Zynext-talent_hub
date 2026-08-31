"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronLeft, ChevronRight, Clock, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AnnouncementBannerStack } from "@/components/announcements/announcement-banner";
import {
  CatalogFiltersBar,
  hasActiveCatalogFilters,
  type CatalogFilters,
} from "@/components/catalog/catalog-filters";
import { CatalogFavoriteButton } from "@/components/catalog/catalog-favorite-button";
import { DueDateBadge, DueDateLine } from "@/components/learner/due-date-display";
import { useAuth } from "@/hooks/useAuth";
import { useCourseCatalog, useSelfEnrollCourse } from "@/hooks/useCourses";
import { useOrganization } from "@/hooks/useOrganization";
import { hasDueDateAlert } from "@/lib/enrollment-due";
import { resolveAssetUrl } from "@/lib/certificate-template";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { CatalogCourse } from "@/types";

const PAGE_SIZE = 24;

const availabilityLabels: Record<CatalogCourse["catalogAvailability"], string> = {
  open: "Available now",
  upcoming: "Coming soon",
  closed: "Closed",
};

const availabilityVariants: Record<
  CatalogCourse["catalogAvailability"],
  "default" | "secondary" | "outline"
> = {
  open: "default",
  upcoming: "secondary",
  closed: "outline",
};

function formatAvailabilityDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function availabilityHint(course: CatalogCourse): string | null {
  if (course.catalogAvailability === "upcoming" && course.availableFrom) {
    const formatted = formatAvailabilityDate(course.availableFrom);
    return formatted ? `Available on ${formatted}` : "Not yet available";
  }
  if (course.catalogAvailability === "open" && course.availableUntil) {
    const formatted = formatAvailabilityDate(course.availableUntil);
    return formatted ? `Open until ${formatted}` : null;
  }
  return null;
}

export default function CatalogPage() {
  const { organization, isAuthenticated } = useAuth();
  const { data: org } = useOrganization();
  const selfEnroll = useSelfEnrollCourse();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<CatalogFilters>({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = search.trim();
      setQ((prev) => {
        if (prev !== next) setPage(1);
        return next;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useCourseCatalog({
    page,
    pageSize: PAGE_SIZE,
    q: q || undefined,
    availability: filters.availability,
    enrolled: filters.enrolled,
    prerequisitesMet: filters.prerequisitesMet,
    duration: filters.duration,
  });

  const allowSelfEnrollment = useMemo(
    () => org?.settings?.allowSelfEnrollment ?? organization?.settings?.allowSelfEnrollment ?? false,
    [org?.settings?.allowSelfEnrollment, organization?.settings?.allowSelfEnrollment],
  );

  const totalPages = data?.totalPages ?? 0;
  const total = data?.total ?? 0;

  async function handleEnroll(courseId: string) {
    await selfEnroll.mutateAsync(courseId);
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Course catalog"
        description="Browse published courses and enroll when self-enrollment is enabled."
      />
      <div className="px-6 pt-4">
        <AnnouncementBannerStack />
      </div>
      <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search catalog"
            className="pl-8"
          />
        </div>
      </div>
      <CatalogFiltersBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />
      <div className="grid flex-1 gap-4 px-6 py-6 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)
        ) : data?.items?.length ? (
          data.items.map((course) => {
            const hint = availabilityHint(course);
            const canEnroll =
              allowSelfEnrollment &&
              course.catalogAvailability === "open" &&
              !course.enrolled &&
              course.prerequisitesMet;
            const enrolling =
              selfEnroll.isPending && selfEnroll.variables === course.id;

            return (
              <Card
                key={course.id}
                className="flex flex-col overflow-hidden shadow-luxury transition-shadow hover:shadow-luxury-lg"
              >
                <div className="relative h-32 bg-hero-gradient">
                  {course.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveAssetUrl(course.thumbnailUrl)}
                      alt=""
                      className="h-full w-full object-cover opacity-80"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen className="h-10 w-10 text-indigo/40" />
                    </div>
                  )}
                  <Badge
                    variant={availabilityVariants[course.catalogAvailability]}
                    className="absolute right-3 top-3"
                  >
                    {availabilityLabels[course.catalogAvailability]}
                  </Badge>
                  {course.enrolled && hasDueDateAlert(course) ? (
                    <div className="absolute left-3 top-3">
                      <DueDateBadge enrollment={course} />
                    </div>
                  ) : null}
                  {isAuthenticated ? (
                    <CatalogFavoriteButton courseId={course.id} favorited={course.favorited} />
                  ) : null}
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="line-clamp-2 text-base">{course.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 pb-2">
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {course.description ?? "No description"}
                  </p>
                  {course.prerequisites.length > 0 && (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Requires: {course.prerequisites.map((item) => item.title).join(", ")}
                    </p>
                  )}
                  {hint ? (
                    <p className="text-muted-foreground mt-2 text-xs">{hint}</p>
                  ) : null}
                  {course.enrolled && course.dueAt ? (
                    <DueDateLine enrollment={course} className="mt-2" />
                  ) : null}
                  {course.enrolled && course.progressPercent != null && course.progressPercent > 0 ? (
                    <p className="text-muted-foreground mt-2 text-xs tabular-nums">
                      {course.progressPercent}% complete
                    </p>
                  ) : null}
                  <div className="text-muted-foreground mt-3 flex flex-wrap gap-3 text-xs">
                    {course.lessonCount !== undefined && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {course.lessonCount} lessons
                      </span>
                    )}
                    {course.durationMinutes != null && course.durationMinutes > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {course.durationMinutes} min
                      </span>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="gap-2 border-t border-border/60 pt-4">
                  {course.enrolled ? (
                    <Button size="sm" className="w-full" asChild>
                      <Link href={`/learn/${course.id}`}>Continue learning</Link>
                    </Button>
                  ) : canEnroll ? (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={enrolling}
                      onClick={() => handleEnroll(course.id)}
                    >
                      {enrolling ? (
                        <>
                          <Loader2 className="animate-spin" />
                          Enrolling…
                        </>
                      ) : (
                        "Enroll"
                      )}
                    </Button>
                  ) : course.catalogAvailability === "upcoming" ? (
                    <Button size="sm" variant="outline" className="w-full" disabled>
                      Not yet available
                    </Button>
                  ) : !course.prerequisitesMet && course.prerequisites.length > 0 ? (
                    <Button size="sm" variant="outline" className="w-full" disabled>
                      Complete prerequisites first
                    </Button>
                  ) : allowSelfEnrollment ? (
                    <Button size="sm" variant="outline" className="w-full" disabled>
                      Enrollment unavailable
                    </Button>
                  ) : (
                    <p className="text-muted-foreground w-full text-center text-xs">
                      Contact your administrator to enroll
                    </p>
                  )}
                </CardFooter>
              </Card>
            );
          })
        ) : (
          <div className="text-muted-foreground col-span-full flex flex-col items-center justify-center py-16 text-sm">
            <BookOpen className="mb-4 h-12 w-12 opacity-40" />
            {hasActiveCatalogFilters(filters) || q
              ? "No courses match your filters."
              : "No published courses in the catalog yet."}
          </div>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 px-6 pb-6">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground text-sm tabular-nums">
            {page} / {totalPages}
            {total ? ` · ${total}` : ""}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
