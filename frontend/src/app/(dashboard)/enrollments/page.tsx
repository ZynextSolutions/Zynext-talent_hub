"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus, Search, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { useCourses } from "@/hooks/useCourses";
import { useCreateEnrollment, useEnrollments, useRevokeEnrollment } from "@/hooks/useEnrollments";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/hooks/useAuth";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 50;
const ALL = "all";

const STATUSES = [
  { value: ALL, label: "All statuses" },
  { value: "ENROLLED", label: "Enrolled" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REVOKED", label: "Revoked" },
] as const;

const statusLabel: Record<string, string> = {
  ENROLLED: "Enrolled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  REVOKED: "Revoked",
};

function statusVariant(status: string): "default" | "secondary" | "success" | "outline" {
  if (status === "IN_PROGRESS") return "default";
  if (status === "COMPLETED") return "success";
  if (status === "REVOKED") return "outline";
  return "secondary";
}

function learnerName(enrollment: {
  userId: string;
  user?: { firstName: string; lastName: string; email?: string };
}) {
  if (enrollment.user) return `${enrollment.user.firstName} ${enrollment.user.lastName}`.trim();
  return enrollment.userId.slice(0, 8);
}

export default function EnrollmentsPage() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("enrollment:write");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [courseFilter, setCourseFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);

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

  const filtersActive = Boolean(q) || courseFilter !== ALL || statusFilter !== ALL;

  const { data, isLoading, isFetching } = useEnrollments({
    page,
    pageSize: PAGE_SIZE,
    q: q || undefined,
    courseId: courseFilter === ALL ? undefined : courseFilter,
    status: statusFilter === ALL ? undefined : statusFilter,
  });
  const { data: users } = useUsers({ pageSize: 100 });
  const { data: courses } = useCourses({ pageSize: 100 });
  const publishedCourses = courses?.items?.filter((c) => c.status === "PUBLISHED");
  const createEnrollment = useCreateEnrollment();
  const revokeEnrollment = useRevokeEnrollment();

  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  async function handleCreate() {
    if (!userId || !courseId) return;
    await createEnrollment.mutateAsync({
      userId,
      courseId,
      dueAt: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
    });
    setOpen(false);
    setUserId("");
    setCourseId("");
    setDueDate("");
  }

  function clearFilters() {
    setSearch("");
    setQ("");
    setCourseFilter(ALL);
    setStatusFilter(ALL);
    setPage(1);
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Enrollments"
        description="View and manage individual course enrollments."
        actions={
          canWrite ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Enroll user
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create enrollment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>User</Label>
                    <Select value={userId} onValueChange={setUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.items?.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.firstName} {u.lastName} ({u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Course</Label>
                    <Select value={courseId} onValueChange={setCourseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select course" />
                      </SelectTrigger>
                      <SelectContent>
                        {publishedCourses?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Due date (optional)</Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleCreate}
                    disabled={!userId || !courseId || createEnrollment.isPending}
                  >
                    {createEnrollment.isPending ? <Loader2 className="animate-spin" /> : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <div className="flex-1 px-6 py-6">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-luxury">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by learner or course"
                className="h-8 pl-8 pr-8 text-sm"
                aria-label="Filter enrollments"
              />
              {search ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <Select
              value={courseFilter}
              onValueChange={(value) => {
                setCourseFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[11.5rem] text-xs">
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All courses</SelectItem>
                {courses?.items?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[9.5rem] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtersActive ? (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearFilters}>
                Clear
              </Button>
            ) : null}
            <span className="text-muted-foreground ml-auto flex items-center gap-1.5 text-xs tabular-nums">
              {isFetching && !isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {total === 0 ? "0" : `${from}–${to} of ${total}`}
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-8 px-3 text-xs">Learner</TableHead>
                <TableHead className="h-8 px-3 text-xs">Course</TableHead>
                <TableHead className="h-8 px-3 text-xs">Status</TableHead>
                <TableHead className="hidden h-8 px-3 text-xs md:table-cell">Progress</TableHead>
                <TableHead className="hidden h-8 px-3 text-xs lg:table-cell">Due</TableHead>
                <TableHead className="h-8 w-16 px-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell colSpan={6} className="px-3 py-1.5">
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : data?.items?.length ? (
                data.items.map((enrollment) => {
                  const canRevoke =
                    canWrite &&
                    (enrollment.status === "ENROLLED" || enrollment.status === "IN_PROGRESS");
                  return (
                    <TableRow key={enrollment.id}>
                      <TableCell className="max-w-[16rem] px-3 py-1.5">
                        <p className="truncate text-sm font-medium leading-tight">
                          {learnerName(enrollment)}
                        </p>
                        {enrollment.user?.email ? (
                          <p className="text-muted-foreground truncate text-[11px] leading-tight">
                            {enrollment.user.email}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[14rem] px-3 py-1.5 text-sm">
                        <span className="line-clamp-1">
                          {enrollment.course?.title ?? enrollment.courseId.slice(0, 8)}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-1.5">
                        <Badge
                          variant={statusVariant(enrollment.status)}
                          className="px-1.5 py-0 text-[10px] font-medium"
                        >
                          {statusLabel[enrollment.status] ?? enrollment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden px-3 py-1.5 md:table-cell">
                        <div className="flex items-center gap-2">
                          <Progress value={enrollment.progressPercent} className="h-1.5 w-16" />
                          <span className="text-muted-foreground w-8 text-xs tabular-nums">
                            {enrollment.progressPercent}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "hidden px-3 py-1.5 text-xs tabular-nums lg:table-cell",
                          enrollment.isOverdue
                            ? "text-destructive"
                            : enrollment.isDueSoon
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground",
                        )}
                      >
                        {enrollment.dueAt ? formatDate(enrollment.dueAt) : "—"}
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        {canRevoke ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-destructive"
                            disabled={revokeEnrollment.isPending}
                            onClick={() => {
                              if (confirm("Revoke this enrollment?")) {
                                revokeEnrollment.mutate(enrollment.id);
                              }
                            }}
                          >
                            Revoke
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="text-muted-foreground h-24 text-center text-sm">
                    {filtersActive ? "No enrollments match these filters." : "No enrollments found."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {totalPages > 1 ? (
            <div className="flex items-center justify-end gap-1 border-t border-border px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-muted-foreground px-2 text-xs tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
