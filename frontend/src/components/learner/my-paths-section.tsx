"use client";

import Link from "next/link";
import { GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { PathEnrollment } from "@/types";

export function MyPathsSection({
  items,
  isLoading,
}: {
  items: PathEnrollment[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Learning paths</h2>
        <Skeleton className="h-32 rounded-xl" />
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Learning paths</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((enrollment) => (
          <Card key={enrollment.id} className="shadow-luxury">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <GitBranch className="text-indigo mt-0.5 h-4 w-4 shrink-0" />
                  <h3 className="text-sm font-semibold">{enrollment.path?.title ?? "Learning path"}</h3>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {enrollment.status.replaceAll("_", " ")}
                </Badge>
              </div>
              <div className="space-y-1.5">
                <Progress value={enrollment.progressPercent} className="h-1.5" />
                <p className="text-muted-foreground text-xs tabular-nums">{enrollment.progressPercent}% complete</p>
              </div>
            </CardContent>
            <CardFooter className="border-t border-border/60 p-4 pt-0">
              {enrollment.pathId ? (
                <Button size="sm" className="w-full" asChild>
                  <Link href={`/learning-paths/${enrollment.pathId}`}>Continue path</Link>
                </Button>
              ) : null}
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
