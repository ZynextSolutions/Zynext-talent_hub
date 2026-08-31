"use client";

import { useMemo, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCourseRevision, useCourseRevisions } from "@/hooks/useCourses";
import { cn } from "@/lib/utils";

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function CourseRevisionPanel({ courseId }: { courseId: string }) {
  const { data: revisions, isLoading } = useCourseRevisions(courseId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? revisions?.[0]?.id ?? null;
  const { data: detail, isLoading: detailLoading } = useCourseRevision(courseId, activeId);

  const publisherLabel = useMemo(() => {
    if (!detail?.publishedBy) return "Unknown publisher";
    return `${detail.publishedBy.firstName} ${detail.publishedBy.lastName}`.trim();
  }, [detail?.publishedBy]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!revisions?.length) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-dashed border-border p-8 text-center">
        <History className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
        <h3 className="text-sm font-semibold">No published versions yet</h3>
        <p className="text-muted-foreground mt-2 text-sm">
          Each time you publish, a read-only snapshot is saved here for audit and comparison.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="rounded-lg border border-border">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Publish history</h3>
          <p className="text-muted-foreground text-xs">{revisions.length} version{revisions.length === 1 ? "" : "s"}</p>
        </div>
        <ScrollArea className="h-[28rem]">
          <div className="space-y-1 p-2">
            {revisions.map((revision) => {
              const active = revision.id === activeId;
              return (
                <button
                  key={revision.id}
                  type="button"
                  onClick={() => setSelectedId(revision.id)}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                    active ? "bg-indigo/15 text-indigo ring-1 ring-indigo/20" : "hover:bg-secondary",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">Version {revision.versionNumber}</span>
                    {revision.versionNumber === revisions[0]?.versionNumber && (
                      <Badge variant="secondary" className="text-[10px]">
                        Latest
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 truncate text-xs">{revision.title}</p>
                  <p className="text-muted-foreground mt-1 text-[11px]">{formatWhen(revision.publishedAt)}</p>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      <section className="rounded-lg border border-border p-5">
        {detailLoading || !detail ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Version {detail.versionNumber}</p>
              <h3 className="mt-1 text-lg font-semibold">{detail.snapshot.course.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                Published {formatWhen(detail.publishedAt)} by {publisherLabel}
              </p>
            </div>

            {detail.snapshot.course.description ? (
              <p className="text-sm leading-relaxed">{detail.snapshot.course.description}</p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border px-3 py-2">
                <p className="text-muted-foreground text-xs">Lessons</p>
                <p className="text-lg font-semibold tabular-nums">{detail.snapshot.lessons.length}</p>
              </div>
              <div className="rounded-md border border-border px-3 py-2">
                <p className="text-muted-foreground text-xs">Modules</p>
                <p className="text-lg font-semibold tabular-nums">{detail.snapshot.modules.length}</p>
              </div>
              <div className="rounded-md border border-border px-3 py-2">
                <p className="text-muted-foreground text-xs">Assessments</p>
                <p className="text-lg font-semibold tabular-nums">{detail.snapshot.assessments.length}</p>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">Completion rule</h4>
              <p className="text-muted-foreground text-sm">
                {(detail.snapshot.course.completionMode ?? "ALL_LESSONS")
                  .replaceAll("_", " ")
                  .toLowerCase()}
                {detail.snapshot.course.completionMode === "PERCENTAGE" &&
                detail.snapshot.course.completionPercent
                  ? ` (${detail.snapshot.course.completionPercent}%)`
                  : ""}
              </p>
            </div>

            {detail.snapshot.prerequisites.length ? (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Prerequisites</h4>
                <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                  {detail.snapshot.prerequisites.map((prerequisite) => (
                    <li key={prerequisite.id}>{prerequisite.title}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <h4 className="mb-2 text-sm font-semibold">Outline snapshot</h4>
              <div className="space-y-3">
                {detail.snapshot.modules.map((module) => (
                  <div key={module.id} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium">{module.title}</p>
                    <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id}>
                          {lesson.title}
                          {lesson.required === false ? " (optional)" : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {detail.snapshot.lessons.filter((lesson) => !lesson.moduleId).length ? (
                  <div className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium">Uncategorized</p>
                    <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                      {detail.snapshot.lessons
                        .filter((lesson) => !lesson.moduleId)
                        .map((lesson) => (
                          <li key={lesson.id}>
                            {lesson.title}
                            {lesson.required === false ? " (optional)" : ""}
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
