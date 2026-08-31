"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { ReportType } from "@/hooks/useReports";
import type { AnalyticsFilters } from "@/hooks/useAnalytics";

export type ReportFormat = "CSV" | "PDF" | "XLSX";
export type ReportFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export type ScheduledReport = {
  id: string;
  reportType: ReportType;
  filters: AnalyticsFilters & { from?: string; to?: string; status?: string; certStatus?: string; q?: string };
  format: ReportFormat;
  frequency: ReportFrequency;
  recipients: string[];
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  creator: { id: string; name: string; email: string } | null;
};

export type CreateScheduledReportInput = {
  reportType: ReportType;
  filters?: ScheduledReport["filters"];
  format?: ReportFormat;
  frequency: ReportFrequency;
  recipients: string[];
  enabled?: boolean;
};

export function useScheduledReports(enabled = true) {
  return useQuery({
    queryKey: ["report-schedules"],
    queryFn: () => api.get<ScheduledReport[]>("/reports/schedules"),
    enabled,
  });
}

export function useCreateScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateScheduledReportInput) =>
      api.post<ScheduledReport>("/reports/schedules", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-schedules"] });
      toast.success("Schedule created");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create schedule"),
  });
}

export function useUpdateScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CreateScheduledReportInput> & { id: string; enabled?: boolean }) =>
      api.patch<ScheduledReport>(`/reports/schedules/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-schedules"] });
      toast.success("Schedule updated");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update schedule"),
  });
}

export function useDeleteScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: boolean }>(`/reports/schedules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-schedules"] });
      toast.success("Schedule deleted");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete schedule"),
  });
}
