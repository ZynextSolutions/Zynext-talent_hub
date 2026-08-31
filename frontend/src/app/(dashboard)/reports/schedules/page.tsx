"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ReportFilters } from "@/components/analytics/report-filters";
import { defaultDateRange, type AnalyticsFilters } from "@/hooks/useAnalytics";
import {
  useCreateScheduledReport,
  useDeleteScheduledReport,
  useScheduledReports,
  useUpdateScheduledReport,
  type ReportFormat,
  type ReportFrequency,
  type ScheduledReport,
} from "@/hooks/useScheduledReports";
import { type ReportType } from "@/hooks/useReports";
import { useAuth } from "@/hooks/useAuth";
import { useOrgTree } from "@/hooks/useOrgTree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const REPORT_TYPES = [
  { id: "enrollments" as ReportType, label: "Enrollments" },
  { id: "completions" as ReportType, label: "Completions" },
  { id: "progress" as ReportType, label: "Progress" },
  { id: "assessments" as ReportType, label: "Assessments" },
  { id: "certificates" as ReportType, label: "Certificates" },
  { id: "overdue-training" as ReportType, label: "Overdue training" },
  { id: "activity" as ReportType, label: "Activity" },
];

type ScheduleForm = {
  reportType: ReportType;
  format: ReportFormat;
  frequency: ReportFrequency;
  recipients: string;
  from: string;
  to: string;
  filters: AnalyticsFilters;
};

function emptyForm(defaults: { from: string; to: string }): ScheduleForm {
  return {
    reportType: "enrollments",
    format: "CSV",
    frequency: "WEEKLY",
    recipients: "",
    from: defaults.from,
    to: defaults.to,
    filters: {},
  };
}

function formFromSchedule(row: ScheduledReport): ScheduleForm {
  return {
    reportType: row.reportType,
    format: row.format,
    frequency: row.frequency,
    recipients: row.recipients.join(", "),
    from: row.filters.from ?? defaultDateRange().from,
    to: row.filters.to ?? defaultDateRange().to,
    filters: {
      divisionId: row.filters.divisionId,
      departmentId: row.filters.departmentId,
      teamId: row.filters.teamId,
      courseId: row.filters.courseId,
      userId: row.filters.userId,
    },
  };
}

export default function ReportSchedulesPage() {
  const { hasPermission, user } = useAuth();
  const canSchedule = hasPermission("reports:schedule");
  const isOrgAdmin = user?.role === "ORG_ADMIN";
  const defaults = defaultDateRange();

  const schedules = useScheduledReports(canSchedule);
  const { data: orgTree } = useOrgTree(false);
  const createSchedule = useCreateScheduledReport();
  const updateSchedule = useUpdateScheduledReport();
  const deleteSchedule = useDeleteScheduledReport();

  const [createForm, setCreateForm] = useState<ScheduleForm>(() => emptyForm(defaults));
  const [editing, setEditing] = useState<ScheduledReport | null>(null);
  const [editForm, setEditForm] = useState<ScheduleForm>(() => emptyForm(defaults));

  useEffect(() => {
    if (editing) setEditForm(formFromSchedule(editing));
  }, [editing]);

  if (!canSchedule) {
    return (
      <div className="flex flex-1 flex-col overflow-auto">
        <PageHeader title="Scheduled reports" description="You do not have permission to manage report schedules." />
      </div>
    );
  }

  function parseRecipients(value: string) {
    return value
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);
  }

  function buildFilters(form: ScheduleForm) {
    return {
      from: form.from,
      to: form.to,
      ...form.filters,
    };
  }

  const handleCreate = () => {
    const list = parseRecipients(createForm.recipients);
    if (!list.length) return;
    createSchedule.mutate(
      {
        reportType: createForm.reportType,
        format: createForm.format,
        frequency: createForm.frequency,
        recipients: list,
        filters: buildFilters(createForm),
      },
      {
        onSuccess: () => setCreateForm(emptyForm(defaults)),
      },
    );
  };

  const handleUpdate = () => {
    if (!editing) return;
    const list = parseRecipients(editForm.recipients);
    if (!list.length) return;
    updateSchedule.mutate(
      {
        id: editing.id,
        reportType: editForm.reportType,
        format: editForm.format,
        frequency: editForm.frequency,
        recipients: list,
        filters: buildFilters(editForm),
      },
      { onSuccess: () => setEditing(null) },
    );
  };

  function ScheduleFields({
    form,
    onChange,
  }: {
    form: ScheduleForm;
    onChange: (next: ScheduleForm) => void;
  }) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Report</Label>
            <Select
              value={form.reportType}
              onValueChange={(v) => onChange({ ...form, reportType: v as ReportType })}
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
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select value={form.format} onValueChange={(v) => onChange({ ...form, format: v as ReportFormat })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CSV">CSV</SelectItem>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="XLSX">Excel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Frequency</Label>
            <Select
              value={form.frequency}
              onValueChange={(v) => onChange({ ...form, frequency: v as ReportFrequency })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Daily</SelectItem>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label>Recipients (comma-separated)</Label>
            <Input
              placeholder="admin@company.com, manager@company.com"
              value={form.recipients}
              onChange={(e) => onChange({ ...form, recipients: e.target.value })}
            />
          </div>
        </div>
        <ReportFilters
          from={form.from}
          to={form.to}
          onFromChange={(v) => onChange({ ...form, from: v })}
          onToChange={(v) => onChange({ ...form, to: v })}
          filters={form.filters}
          onFiltersChange={(filters) => onChange({ ...form, filters })}
          orgTree={orgTree}
          showOrgFilters={isOrgAdmin}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Scheduled reports"
        description="Automate report delivery by email on a daily, weekly, or monthly cadence."
        actions={
          <Button variant="ghost" asChild>
            <Link href="/reports">Back to reports</Link>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-8">
        <section className="space-y-4 rounded-lg border p-4">
          <h2 className="font-medium">New schedule</h2>
          <ScheduleFields form={createForm} onChange={setCreateForm} />
          <Button disabled={createSchedule.isPending || !createForm.recipients.trim()} onClick={handleCreate}>
            {createSchedule.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Create schedule
          </Button>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">Active schedules</h2>
          {schedules.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Date window</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(schedules.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground text-center">
                      No schedules yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (schedules.data ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {REPORT_TYPES.find((r) => r.id === row.reportType)?.label ?? row.reportType}
                      </TableCell>
                      <TableCell>{row.format}</TableCell>
                      <TableCell>{row.frequency}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {row.filters.from ?? "—"} → {row.filters.to ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate">{row.recipients.join(", ")}</TableCell>
                      <TableCell>
                        <Badge variant={row.enabled ? "success" : "secondary"}>
                          {row.enabled ? "Enabled" : "Paused"}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.nextRunAt?.slice(0, 10) ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditing(row)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateSchedule.mutate({ id: row.id, enabled: !row.enabled })}
                          >
                            {row.enabled ? "Pause" : "Enable"}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteSchedule.mutate(row.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </section>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit schedule</DialogTitle>
          </DialogHeader>
          <ScheduleFields form={editForm} onChange={setEditForm} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={updateSchedule.isPending || !editForm.recipients.trim()} onClick={handleUpdate}>
              {updateSchedule.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
