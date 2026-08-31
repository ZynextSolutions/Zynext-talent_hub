"use client";

import { EnrollmentCourseCard } from "@/components/learner/enrollment-course-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Enrollment } from "@/types";

export function DueSoonSection({
  items,
  isLoading,
}: {
  items: Enrollment[];
  isLoading?: boolean;
}) {
  if (isLoading) return null;
  if (!items.length) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Due soon & overdue</h2>
        <p className="text-muted-foreground text-sm">Assigned training with upcoming or past due dates.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((enrollment) => (
          <EnrollmentCourseCard key={enrollment.id} enrollment={enrollment} actionLabel="Continue" />
        ))}
      </div>
    </section>
  );
}

export function AssignedNotStartedSection({
  items,
  isLoading,
}: {
  items: Enrollment[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Assigned to you</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Assigned to you</h2>
        <p className="text-muted-foreground text-sm">Courses waiting for you to get started.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((enrollment) => (
          <EnrollmentCourseCard key={enrollment.id} enrollment={enrollment} actionLabel="Start course" />
        ))}
      </div>
    </section>
  );
}
