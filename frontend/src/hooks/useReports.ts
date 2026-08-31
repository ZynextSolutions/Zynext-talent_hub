"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, apiGetBlob } from "@/lib/api-client";
import type { Paginated } from "@/types";
import type { AnalyticsFilters } from "@/hooks/useAnalytics";

export type ReportType =
  | "enrollments"
  | "completions"
  | "progress"
  | "assessments"
  | "certificates"
  | "overdue-training"
  | "activity";

export type ReportQueryParams = AnalyticsFilters & {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  status?: string;
  certStatus?: "active" | "revoked" | "expiring" | "expired";
  sort?: string;
  q?: string;
};

function buildQuery(params?: ReportQueryParams): string {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  if (params?.divisionId) search.set("divisionId", params.divisionId);
  if (params?.departmentId) search.set("departmentId", params.departmentId);
  if (params?.teamId) search.set("teamId", params.teamId);
  if (params?.courseId) search.set("courseId", params.courseId);
  if (params?.userId) search.set("userId", params.userId);
  if (params?.status) search.set("status", params.status);
  if (params?.certStatus) search.set("certStatus", params.certStatus);
  if (params?.sort) search.set("sort", params.sort);
  if (params?.q) search.set("q", params.q);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function useReport<T extends Record<string, unknown>>(
  type: ReportType,
  params?: ReportQueryParams,
  enabled = true,
) {
  return useQuery({
    queryKey: ["reports", type, params],
    queryFn: () => api.get<Paginated<T>>(`/reports/${type}${buildQuery(params)}`),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useExportReport() {
  return useMutation({
    mutationFn: async ({
      type,
      params,
      format = "csv",
    }: {
      type: ReportType;
      params?: ReportQueryParams;
      format?: "csv" | "pdf" | "xlsx";
    }) => {
      const search = new URLSearchParams(buildQuery(params).replace(/^\?/, ""));
      search.set("format", format);
      const qs = search.toString();
      const blob = await apiGetBlob(`/reports/${type}/export${qs ? `?${qs}` : ""}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${type}-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: (_data, vars) => toast.success(`Report exported as ${vars.format?.toUpperCase() ?? "CSV"}`),
    onError: (err: Error) => toast.error(err.message || "Failed to export report"),
  });
}
