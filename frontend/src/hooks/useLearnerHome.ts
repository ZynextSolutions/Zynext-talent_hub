"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useEnrollments } from "@/hooks/useEnrollments";
import type { Certificate, Enrollment, Paginated, PathEnrollment } from "@/types";

function isActiveEnrollment(enrollment: Enrollment) {
  return (
    enrollment.status !== "COMPLETED" &&
    enrollment.status !== "REVOKED" &&
    enrollment.progressPercent < 100
  );
}

function sortByUpdatedDesc(a: Enrollment, b: Enrollment) {
  const aTime = new Date(a.updatedAt ?? a.enrolledAt ?? 0).getTime();
  const bTime = new Date(b.updatedAt ?? b.enrolledAt ?? 0).getTime();
  return bTime - aTime;
}

function sortByDueAsc(a: Enrollment, b: Enrollment) {
  const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  return aTime - bTime;
}

export function useLearnerHome() {
  const enrollmentsQuery = useEnrollments({ pageSize: 50 });

  const [pathsQuery, certificatesQuery] = useQueries({
    queries: [
      {
        queryKey: ["learning-paths", "my"],
        queryFn: () => api.get<PathEnrollment[]>("/learning-paths/my"),
      },
      {
        queryKey: ["certificates", { pageSize: 5 }],
        queryFn: () => api.get<Paginated<Certificate>>("/certificates?pageSize=5"),
      },
    ],
  });

  const buckets = useMemo(() => {
    const enrollments = enrollmentsQuery.data?.items ?? [];
    const active = enrollments.filter(isActiveEnrollment);

    const continueLearning = active
      .filter((row) => row.progressPercent > 0)
      .sort(sortByUpdatedDesc)
      .slice(0, 6);

    const assignedNotStarted = active
      .filter((row) => row.progressPercent === 0)
      .sort(sortByUpdatedDesc)
      .slice(0, 6);

    const dueItems = active
      .filter((row) => row.isOverdue || row.isDueSoon)
      .sort(sortByDueAsc)
      .slice(0, 6);

    const paths = (pathsQuery.data ?? []).filter((row) => row.status !== "COMPLETED");
    const recentCertificates = certificatesQuery.data?.items ?? [];

    const completedCount = enrollments.filter((row) => row.status === "COMPLETED").length;
    const overdueCount = active.filter((row) => row.isOverdue).length;
    const dueSoonCount = active.filter((row) => row.isDueSoon && !row.isOverdue).length;

    return {
      continueLearning,
      assignedNotStarted,
      dueItems,
      paths,
      recentCertificates,
      stats: {
        inProgressCount: active.length,
        overdueCount,
        dueSoonCount,
        completedCount,
      },
    };
  }, [enrollmentsQuery.data?.items, pathsQuery.data, certificatesQuery.data?.items]);

  const isLoading =
    enrollmentsQuery.isLoading || pathsQuery.isLoading || certificatesQuery.isLoading;

  const isError =
    enrollmentsQuery.isError || pathsQuery.isError || certificatesQuery.isError;

  return {
    ...buckets,
    isLoading,
    isError,
    refetch: () => {
      void enrollmentsQuery.refetch();
      void pathsQuery.refetch();
      void certificatesQuery.refetch();
    },
  };
}
