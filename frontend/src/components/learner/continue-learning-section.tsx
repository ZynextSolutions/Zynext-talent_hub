"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { EnrollmentCourseCard } from "@/components/learner/enrollment-course-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Enrollment } from "@/types";

export function ContinueLearningSection({
  items,
  isLoading,
}: {
  items: Enrollment[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Continue learning</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (!items.length) {
    return (
      <section className="rounded-xl border border-dashed border-border p-8 text-center">
        <BookOpen className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
        <h2 className="text-base font-semibold">Continue learning</h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
          No courses in progress yet. Browse the catalog to enroll and start learning.
        </p>
        <Button className="mt-4" asChild>
          <Link href="/catalog">Browse catalog</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Continue learning</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((enrollment) => (
          <EnrollmentCourseCard key={enrollment.id} enrollment={enrollment} />
        ))}
      </div>
    </section>
  );
}
