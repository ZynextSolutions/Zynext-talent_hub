"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { EnrollmentTimePoint } from "@/components/charts/enrollment-area-chart";

function ChartSkeleton() {
  return <Skeleton className="h-full w-full" />;
}

export const EnrollmentAreaChart = dynamic(
  () =>
    import("@/components/charts/enrollment-area-chart").then((m) => m.EnrollmentAreaChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const EnrollmentBarChart = dynamic(
  () =>
    import("@/components/charts/enrollment-bar-chart").then((m) => m.EnrollmentBarChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const NamedBarChart = dynamic(
  () => import("@/components/charts/named-bar-chart").then((m) => m.NamedBarChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export type { EnrollmentTimePoint };
