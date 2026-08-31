"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateLearningPath,
  useEnrollLearningPath,
  useLearningPaths,
  useMyPathEnrollments,
  usePublishLearningPath,
} from "@/hooks/useLearningPaths";
import { useCourses } from "@/hooks/useCourses";
import { useAuth } from "@/hooks/useAuth";

export default function LearningPathsPage() {
  const { data: paths, isLoading } = useLearningPaths();
  const { data: myPaths } = useMyPathEnrollments();
  const { data: courses } = useCourses({ status: "PUBLISHED" });
  const createPath = useCreateLearningPath();
  const { user, hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const publish = usePublishLearningPath();
  const enrollMe = useEnrollLearningPath();

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Learning paths"
        description="Sequential course programs with unlock-on-complete progression."
        actions={
          hasPermission("learning-path:write") ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New path
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create learning path</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 py-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button
                    onClick={async () => {
                      await createPath.mutateAsync({ title: title.trim() });
                      setOpen(false);
                      setTitle("");
                    }}
                    disabled={!title.trim() || createPath.isPending}
                  >
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-8">
        {myPaths?.length ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">My learning paths</h2>
            {myPaths.map((enrollment) => (
              <Card key={enrollment.id} className="shadow-luxury">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{enrollment.path?.title ?? "Learning path"}</p>
                    <p className="text-muted-foreground text-sm">{enrollment.status}</p>
                  </div>
                  {enrollment.pathId && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/learning-paths/${enrollment.pathId}`}>View path</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </section>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-sm font-semibold">All paths</h2>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : paths?.length ? (
          paths.map((path) => (
            <Card key={path.id} className="shadow-luxury">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{path.title}</CardTitle>
                  <p className="text-muted-foreground text-sm">{path.description || "No description"}</p>
                </div>
                <Badge variant={path.status === "PUBLISHED" ? "default" : "secondary"}>{path.status}</Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <span className="text-muted-foreground text-sm">{path.courseCount} courses</span>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/learning-paths/${path.id}`}>Manage</Link>
                </Button>
                {hasPermission("learning-path:write") && path.status === "DRAFT" && (
                  <Button
                    size="sm"
                    disabled={!path.courseCount || publish.isPending}
                    onClick={() => publish.mutate(path.id)}
                  >
                    Publish
                  </Button>
                )}
                {path.status === "PUBLISHED" && user && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={enrollMe.isPending}
                    onClick={() => enrollMe.mutate({ userId: user.id, pathId: path.id })}
                  >
                    Enroll me
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">No learning paths yet.</p>
        )}
        </section>

        {courses?.items?.length ? (
          <p className="text-muted-foreground text-xs">
            {courses.items.length} published courses available for path assignment.
          </p>
        ) : null}
      </div>
    </div>
  );
}
