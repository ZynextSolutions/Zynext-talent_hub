"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Pencil, Send, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/layout/page-header";
import { AssignPathDialog } from "@/components/learning-paths/assign-path-dialog";
import { PathCoursePicker } from "@/components/learning-paths/path-course-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDeleteLearningPath,
  useEnrollLearningPath,
  useLearningPath,
  usePathAssignments,
  usePathEnrollments,
  usePublishLearningPath,
  useSetPathCourses,
  useUpdateLearningPath,
} from "@/hooks/useLearningPaths";
import { useCourses } from "@/hooks/useCourses";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/hooks/useAuth";
import { assignTargetKey, type AssignTargetType } from "@/lib/org-targets";

export function PathManageView({ pathId }: { pathId: string }) {
  const router = useRouter();
  const { data: path, isLoading } = useLearningPath(pathId);
  const { data: courses } = useCourses({ status: "PUBLISHED", pageSize: 100 });
  const { data: enrollments } = usePathEnrollments(pathId);
  const { data: assignments } = usePathAssignments(pathId);
  const { data: users } = useUsers({ pageSize: 100 });
  const setCourses = useSetPathCourses(pathId);
  const enroll = useEnrollLearningPath(pathId);
  const publish = usePublishLearningPath();
  const updatePath = useUpdateLearningPath(pathId);
  const deletePath = useDeleteLearningPath();
  const { user, hasPermission } = useAuth();

  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [enrollUser, setEnrollUser] = useState("");

  const ordered = useMemo(
    () => path?.courses?.slice().sort((a, b) => a.orderIndex - b.orderIndex) ?? [],
    [path?.courses],
  );

  const excludedCourseIds = useMemo(() => new Set(ordered.map((pc) => pc.courseId)), [ordered]);

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users?.items ?? []) {
      map.set(u.id, `${u.firstName} ${u.lastName}`);
    }
    return map;
  }, [users?.items]);

  useEffect(() => {
    if (path) {
      setTitle(path.title);
      setDescription(path.description ?? "");
    }
  }, [path]);

  async function persistCourses(
    entries: Array<{ courseId: string; orderIndex: number; required: boolean }>,
  ) {
    await setCourses.mutateAsync(entries);
  }

  function toPayload(items: typeof ordered) {
    return items.map((pc, orderIndex) => ({
      courseId: pc.courseId,
      orderIndex,
      required: pc.required,
    }));
  }

  async function moveCourse(courseId: string, direction: -1 | 1) {
    const items = ordered.slice();
    const idx = items.findIndex((pc) => pc.courseId === courseId);
    const swap = idx + direction;
    if (idx < 0 || swap < 0 || swap >= items.length) return;
    [items[idx], items[swap]] = [items[swap], items[idx]];
    await persistCourses(toPayload(items));
  }

  async function toggleRequired(courseId: string) {
    const items = ordered.map((pc) =>
      pc.courseId === courseId ? { ...pc, required: !pc.required } : pc,
    );
    await persistCourses(toPayload(items));
  }

  async function removeCourse(courseId: string) {
    const items = ordered.filter((pc) => pc.courseId !== courseId);
    await persistCourses(toPayload(items));
  }

  async function addCourses(courseIds: string[]) {
    const unique = courseIds.filter((id) => !excludedCourseIds.has(id));
    if (!unique.length) return;
    await persistCourses([
      ...toPayload(ordered),
      ...unique.map((courseId, offset) => ({
        courseId,
        orderIndex: ordered.length + offset,
        required: true,
      })),
    ]);
  }

  const canAssign = hasPermission("course:assign");

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title={path?.title ?? "Learning path"}
        description={path?.description ?? "Configure courses and enrollment."}
        actions={
          path ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={path.status === "PUBLISHED" ? "default" : "secondary"}>
                {path.status}
              </Badge>
              {path.status === "DRAFT" && (
                <Button
                  size="sm"
                  disabled={!ordered.length || publish.isPending}
                  onClick={() => publish.mutate(pathId)}
                >
                  {publish.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Publish
                    </>
                  )}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => {
                  if (confirm("Delete this learning path?")) {
                    deletePath.mutate(pathId, { onSuccess: () => router.push("/learning-paths") });
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-8">
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <Card className="shadow-luxury">
              <CardHeader>
                <CardTitle className="text-base">Courses in path</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ordered.length ? (
                  ordered.map((pc, idx) => (
                    <div
                      key={pc.id}
                      className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm"
                    >
                      <span className="text-muted-foreground w-6">{idx + 1}.</span>
                      <span className="flex-1 font-medium">{pc.course?.title ?? pc.courseId}</span>
                      {path?.status === "DRAFT" ? (
                        <>
                          <label className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={pc.required}
                              onCheckedChange={() => toggleRequired(pc.courseId)}
                              disabled={setCourses.isPending}
                            />
                            Required
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={idx === 0 || setCourses.isPending}
                            onClick={() => moveCourse(pc.courseId, -1)}
                          >
                            ↑
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={idx === ordered.length - 1 || setCourses.isPending}
                            onClick={() => moveCourse(pc.courseId, 1)}
                          >
                            ↓
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={setCourses.isPending}
                            onClick={() => removeCourse(pc.courseId)}
                          >
                            Remove
                          </Button>
                        </>
                      ) : (
                        pc.required && (
                          <span className="text-muted-foreground text-xs">Required</span>
                        )
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">No courses assigned yet.</p>
                )}
                {path?.status === "DRAFT" && (
                  <PathCoursePicker
                    courses={courses?.items ?? []}
                    excludedCourseIds={excludedCourseIds}
                    disabled={setCourses.isPending}
                    pending={setCourses.isPending}
                    onAdd={addCourses}
                  />
                )}
              </CardContent>
            </Card>

            {canAssign && path?.status === "PUBLISHED" && (
              <Card className="shadow-luxury">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle className="text-base">Assignments</CardTitle>
                  <AssignPathDialog pathId={pathId} />
                </CardHeader>
                <CardContent className="space-y-2">
                  {assignments?.length ? (
                    assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="rounded-lg border border-border px-4 py-3 text-sm"
                      >
                        <p className="font-medium">{assignment.targetType.replace(/_/g, " ")}</p>
                        <p className="text-muted-foreground text-xs">
                          {assignTargetKey({
                            type: assignment.targetType as AssignTargetType,
                            id: assignment.targetId,
                          })}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No bulk assignments yet.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {hasPermission("enrollment:read") && (
              <Card className="shadow-luxury">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle className="text-base">Enrollments</CardTitle>
                  {hasPermission("enrollment:write") && path?.status === "PUBLISHED" && (
                    <div className="flex items-center gap-2">
                      <Select value={enrollUser} onValueChange={setEnrollUser}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {users?.items?.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.firstName} {u.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        disabled={!enrollUser || enroll.isPending}
                        onClick={() => enroll.mutate({ userId: enrollUser })}
                      >
                        Enroll
                      </Button>
                    </div>
                  )}
                  {user && path?.status === "PUBLISHED" && !hasPermission("enrollment:write") && (
                    <Button
                      size="sm"
                      disabled={enroll.isPending}
                      onClick={() => enroll.mutate({ userId: user.id })}
                    >
                      Enroll me
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {enrollments?.length ? (
                    enrollments.map((e) => (
                      <div key={e.id} className="rounded-lg border border-border px-4 py-3 text-sm">
                        <p className="font-medium">
                          {e.user
                            ? `${e.user.firstName} ${e.user.lastName}`
                            : userNameById.get(e.userId) ?? e.userId.slice(0, 8)}
                        </p>
                        {e.user?.email && (
                          <p className="text-muted-foreground text-xs">{e.user.email}</p>
                        )}
                        <p className="text-muted-foreground text-xs">
                          {e.status} · {e.progressPercent}%
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No enrollments yet.</p>
                  )}
                </CardContent>
              </Card>
            )}

            <Button variant="ghost" asChild>
              <Link href="/learning-paths">Back to paths</Link>
            </Button>
          </>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit learning path</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                await updatePath.mutateAsync({ title: title.trim(), description: description.trim() });
                setEditOpen(false);
              }}
              disabled={!title.trim() || updatePath.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
