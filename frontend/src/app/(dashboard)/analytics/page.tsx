"use client";

import { Suspense } from "react";
import { AnalyticsHub } from "@/components/analytics/analytics-hub";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";

function AnalyticsFallback() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader title="Analytics" description="Zynext Talent Hub reporting for HR, L&D, and executives." />
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-6 py-8">
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsFallback />}>
      <AnalyticsHub />
    </Suspense>
  );
}
