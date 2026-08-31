"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { ReportFilters } from "@/components/analytics/report-filters";
import { defaultDateRange, type AnalyticsFilters } from "@/hooks/useAnalytics";
import { useUserAnalytics } from "@/hooks/useAnalytics";
import { useExportReport, useReport, type ReportType } from "@/hooks/useReports";
import { useAuth } from "@/hooks/useAuth";
import { useOrgTree } from "@/hooks/useOrgTree";
import { useCourses } from "@/hooks/useCourses";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const REPORT_TYPES: Array<{ id: ReportType; label: string; description: string }> = [
  { id: "enrollments", label: "Enrollments", description: "Who is enrolled in what, with status and due dates." },
  { id: "completions", label: "Completions", description: "Courses completed in the selected period." },
  { id: "progress", label: "Progress", description: "In-progress snapshot by learner and course." },
  { id: "assessments", label: "Assessments", description: "Quiz attempts, scores, and pass/fail." },
  { id: "certificates", label: "Certificates", description: "Issued credentials with expiry status." },
  { id: "overdue-training", label: "Overdue training", description: "Mandatory items past their due date." },
  { id: "activity", label: "Activity", description: "Last login and active enrollment counts." },
];

type Column = {
  key: string;
  label: string;
  render?: (row: Record<string, unknown>) => React.ReactNode;
};

function fmtDate(value: unknown) {
  if (!value || typeof value !== "string") return "—";
  return value.slice(0, 10);
}

const COLUMNS: Record<ReportType, Column[]> = {
  enrollments: [
    { key: "learnerName", label: "Learner" },
    { key: "courseTitle", label: "Course" },
    { key: "departmentName", label: "Department" },
    { key: "enrolledAt", label: "Enrolled", render: (r) => fmtDate(r.enrolledAt) },
    { key: "status", label: "Status" },
    { key: "progressPercent", label: "Progress", render: (r) => `${r.progressPercent ?? 0}%` },
    { key: "dueAt", label: "Due", render: (r) => fmtDate(r.dueAt) },
  ],
  completions: [
    { key: "learnerName", label: "Learner" },
    { key: "courseTitle", label: "Course" },
    { key: "departmentName", label: "Department" },
    { key: "completedAt", label: "Completed", render: (r) => fmtDate(r.completedAt) },
    { key: "daysToComplete", label: "Days" },
    { key: "certificateNumber", label: "Certificate" },
  ],
  progress: [
    { key: "learnerName", label: "Learner" },
    { key: "courseTitle", label: "Course" },
    { key: "progressPercent", label: "Progress", render: (r) => `${r.progressPercent ?? 0}%` },
    { key: "status", label: "Status" },
    { key: "lastActivityAt", label: "Last activity", render: (r) => fmtDate(r.lastActivityAt) },
    { key: "lessonsCompleted", label: "Lessons", render: (r) => `${r.lessonsCompleted ?? 0} / ${r.lessonsTotal ?? 0}` },
  ],
  assessments: [
    { key: "learnerName", label: "Learner" },
    { key: "courseTitle", label: "Course" },
    { key: "assessmentTitle", label: "Assessment" },
    { key: "attemptNumber", label: "Attempt" },
    { key: "score", label: "Score" },
    {
      key: "passed",
      label: "Result",
      render: (r) => (
        <Badge variant={r.passed ? "success" : "destructive"}>{r.passed ? "Pass" : "Fail"}</Badge>
      ),
    },
    { key: "submittedAt", label: "Submitted", render: (r) => fmtDate(r.submittedAt) },
  ],
  certificates: [
    { key: "learnerName", label: "Learner" },
    { key: "courseTitle", label: "Course" },
    { key: "certificateNumber", label: "Number" },
    { key: "issuedAt", label: "Issued", render: (r) => fmtDate(r.issuedAt) },
    { key: "expiresAt", label: "Expires", render: (r) => fmtDate(r.expiresAt) },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge variant="outline">{String(r.status ?? "—")}</Badge>,
    },
  ],
  "overdue-training": [
    { key: "learnerName", label: "Learner" },
    { key: "courseTitle", label: "Course" },
    { key: "dueAt", label: "Due", render: (r) => fmtDate(r.dueAt) },
    { key: "daysOverdue", label: "Days overdue" },
    { key: "progressPercent", label: "Progress", render: (r) => `${r.progressPercent ?? 0}%` },
  ],
  activity: [
    { key: "learnerName", label: "Learner" },
    { key: "departmentName", label: "Department" },
    { key: "lastLoginAt", label: "Last login", render: (r) => fmtDate(r.lastLoginAt) },
    {
      key: "loginsInPeriod",
      label: "Logins in period",
      render: (r) => (r.loginsInPeriod == null ? "—" : String(r.loginsInPeriod)),
    },
    { key: "activeEnrollments", label: "Active enrollments" },
    { key: "estimatedHours", label: "Est. hours" },
  ],
};

export default function ReportsPage() {
  const { hasPermission, user } = useAuth();
  const canRead = hasPermission("reports:read") || hasPermission("reports:read:own");
  const canExport = hasPermission("reports:export");
  const canSchedule = hasPermission("reports:schedule");
  const isOrgAdmin = user?.role === "ORG_ADMIN";

  const defaults = defaultDateRange();
  const [reportType, setReportType] = useState<ReportType>("enrollments");
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [transcriptUserId, setTranscriptUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(ALL);
  const [certStatus, setCertStatus] = useState(ALL);

  const { data: orgTree } = useOrgTree(false);
  const { data: courses } = useCourses({ pageSize: 100 });
  const exportReport = useExportReport();

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

  const queryParams = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      from,
      to,
      q: q || undefined,
      divisionId: filters.divisionId,
      departmentId: filters.departmentId,
      teamId: filters.teamId,
      courseId: filters.courseId,
      userId: filters.userId,
      status: status === ALL ? undefined : status,
      certStatus:
        certStatus === ALL ? undefined : (certStatus as "active" | "revoked" | "expiring" | "expired"),
    }),
    [page, from, to, q, filters, status, certStatus],
  );

  const report = useReport<Record<string, unknown>>(reportType, queryParams, canRead);
  const columns = COLUMNS[reportType];
  const transcript = useUserAnalytics(transcriptUserId ?? "");
  const meta = REPORT_TYPES.find((r) => r.id === reportType);
  const total = report.data?.total ?? 0;
  const totalPages = report.data?.totalPages ?? 0;
  const fromRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toRow = Math.min(page * PAGE_SIZE, total);

  if (!canRead) {
    return (
      <div className="flex flex-1 flex-col overflow-auto">
        <PageHeader title="Reports" description="You do not have permission to view standard reports." />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Reports"
        description="Filter, sort, and export operational LMS reports."
        actions={
          <div className="flex flex-wrap gap-2">
            {canSchedule && (
              <Button variant="ghost" asChild>
                <Link href="/reports/schedules">Scheduled reports</Link>
              </Button>
            )}
            {canExport && (
              <>
                <Button
                  variant="outline"
                  disabled={exportReport.isPending}
                  onClick={() => exportReport.mutate({ type: reportType, params: queryParams, format: "csv" })}
                >
                  {exportReport.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  disabled={exportReport.isPending}
                  onClick={() => exportReport.mutate({ type: reportType, params: queryParams, format: "pdf" })}
                >
                  {exportReport.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Export PDF
                </Button>
                <Button
                  variant="outline"
                  disabled={exportReport.isPending}
                  onClick={() => exportReport.mutate({ type: reportType, params: queryParams, format: "xlsx" })}
                >
                  {exportReport.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Export Excel
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 min-w-[12rem]">
            <Label>Report</Label>
            <Select
              value={reportType}
              onValueChange={(v) => {
                setReportType(v as ReportType);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ReportFilters
            from={from}
            to={to}
            onFromChange={(v) => {
              setFrom(v);
              setPage(1);
            }}
            onToChange={(v) => {
              setTo(v);
              setPage(1);
            }}
            filters={filters}
            onFiltersChange={(next) => {
              setFilters(next);
              setPage(1);
            }}
            orgTree={orgTree}
            showOrgFilters={isOrgAdmin}
          />
        </div>

        {meta && <p className="text-muted-foreground text-sm">{meta.description}</p>}

        <div className="flex flex-wrap items-end gap-4">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
            <Input
              placeholder="Search learner name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {reportType === "enrollments" && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="ENROLLED">Enrolled</SelectItem>
                  <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {reportType === "certificates" && (
            <div className="space-y-1.5">
              <Label>Certificate status</Label>
              <Select
                value={certStatus}
                onValueChange={(v) => {
                  setCertStatus(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All active</SelectItem>
                  <SelectItem value="expiring">Expiring soon</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Course</Label>
            <Select
              value={filters.courseId ?? ALL}
              onValueChange={(v) => {
                setFilters((prev) => {
                  const next = { ...prev };
                  if (v === ALL) delete next.courseId;
                  else next.courseId = v;
                  return next;
                });
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All courses" />
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
          </div>
        </div>

        <div className="rounded-xl border shadow-luxury">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : report.data?.items?.length ? (
                report.data.items.map((row, idx) => (
                  <TableRow key={String(row.enrollmentId ?? row.userId ?? row.certificateId ?? idx)}>
                    {columns.map((col) => (
                      <TableCell key={col.key} className={col.key === "learnerName" ? "font-medium" : undefined}>
                        {col.key === "learnerName" && row.userId ? (
                          <button
                            type="button"
                            className="text-left hover:underline"
                            onClick={() => setTranscriptUserId(String(row.userId))}
                          >
                            {String(row.learnerName ?? "—")}
                          </button>
                        ) : col.render ? (
                          col.render(row)
                        ) : (
                          String(row[col.key] ?? "—")
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-muted-foreground py-10 text-center text-sm">
                    No rows match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            {total === 0 ? "No results" : `${fromRow}–${toRow} of ${total}`}
            {report.isFetching && !report.isLoading ? " · Updating…" : ""}
          </p>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <p className="text-muted-foreground text-xs">
          Need charts and KPIs? See{" "}
          <Link href="/analytics" className="text-primary underline-offset-4 hover:underline">
            Analytics
          </Link>
          . CSV exports are capped at 10,000 rows — narrow filters for larger datasets.
        </p>

        {transcriptUserId && (
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-medium">Learner transcript</h3>
              <Button variant="ghost" size="sm" onClick={() => setTranscriptUserId(null)}>
                Close
              </Button>
            </div>
            {transcript.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : Array.isArray(transcript.data) && transcript.data.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transcript.data.map((row: { courseId?: string; course?: { title: string }; status?: string; progressPercent?: number }) => (
                    <TableRow key={row.courseId ?? row.course?.title}>
                      <TableCell>{row.course?.title ?? "—"}</TableCell>
                      <TableCell>{row.status ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.progressPercent ?? 0}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">No enrollments for this learner.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
