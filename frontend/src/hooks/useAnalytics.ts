"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  AnalyticsDailySnapshot,
  AssessmentAnalytics,
  CourseAnalytics,
  DashboardAnalytics,
  EngagementAnalytics,
  LearnerAnalytics,
  OrgLevelAnalytics,
  TrendsAnalytics,
  RoiAnalytics,
} from "@/types";

export type AnalyticsFilters = {
  divisionId?: string;
  departmentId?: string;
  teamId?: string;
  courseId?: string;
  userId?: string;
};

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: formatLocalDate(from),
    to: formatLocalDate(to),
  };
}

function filterParams(filters?: AnalyticsFilters): string {
  if (!filters) return "";
  const parts: string[] = [];
  if (filters.divisionId) parts.push(`divisionId=${filters.divisionId}`);
  if (filters.departmentId) parts.push(`departmentId=${filters.departmentId}`);
  if (filters.teamId) parts.push(`teamId=${filters.teamId}`);
  if (filters.courseId) parts.push(`courseId=${filters.courseId}`);
  if (filters.userId) parts.push(`userId=${filters.userId}`);
  return parts.length ? `&${parts.join("&")}` : "";
}

function rangeParams(from?: string, to?: string, filters?: AnalyticsFilters) {
  const fallback = defaultDateRange();
  const f = from ?? fallback.from;
  const t = to ?? fallback.to;
  return { from: f, to: t, qs: `from=${f}&to=${t}${filterParams(filters)}` };
}

export function useAnalyticsDashboard(
  from?: string,
  to?: string,
  enabled = true,
  filters?: AnalyticsFilters,
) {
  const { from: f, to: t, qs } = rangeParams(from, to, filters);

  return useQuery({
    queryKey: ["analytics", "dashboard", f, t, filters],
    queryFn: () => api.get<DashboardAnalytics>(`/analytics/dashboard?${qs}`),
    enabled,
  });
}

export function useAnalyticsByOrgLevel(
  level: "DIVISION" | "DEPARTMENT" | "TEAM" = "DEPARTMENT",
  from?: string,
  to?: string,
  enabled = true,
  filters?: AnalyticsFilters,
) {
  const { from: f, to: t, qs } = rangeParams(from, to, filters);

  return useQuery({
    queryKey: ["analytics", "by-org-level", level, f, t, filters],
    queryFn: () => api.get<OrgLevelAnalytics>(`/analytics/by-org-level?level=${level}&${qs}`),
    enabled,
  });
}

export function useAnalyticsByRole(
  from?: string,
  to?: string,
  enabled = true,
  filters?: AnalyticsFilters,
) {
  const { from: f, to: t, qs } = rangeParams(from, to, filters);

  return useQuery({
    queryKey: ["analytics", "by-role", f, t, filters],
    queryFn: () => api.get<OrgLevelAnalytics>(`/analytics/by-role?${qs}`),
    enabled,
  });
}

export function useCourseAnalytics(
  from?: string,
  to?: string,
  enabled = true,
  filters?: AnalyticsFilters,
) {
  const { from: f, to: t, qs } = rangeParams(from, to, filters);

  return useQuery({
    queryKey: ["analytics", "courses", f, t, filters],
    queryFn: () => api.get<CourseAnalytics>(`/analytics/courses?${qs}`),
    enabled,
  });
}

export function useLearnerAnalytics(
  from?: string,
  to?: string,
  enabled = true,
  filters?: AnalyticsFilters,
) {
  const { from: f, to: t, qs } = rangeParams(from, to, filters);

  return useQuery({
    queryKey: ["analytics", "learners", f, t, filters],
    queryFn: () => api.get<LearnerAnalytics>(`/analytics/learners?${qs}`),
    enabled,
  });
}

export function useEngagementAnalytics(
  from?: string,
  to?: string,
  enabled = true,
  filters?: AnalyticsFilters,
) {
  const { from: f, to: t, qs } = rangeParams(from, to, filters);

  return useQuery({
    queryKey: ["analytics", "engagement", f, t, filters],
    queryFn: () => api.get<EngagementAnalytics>(`/analytics/engagement?${qs}`),
    enabled,
  });
}

export type TrendGranularity = "day" | "week" | "month";

export function useTrendsAnalytics(
  from?: string,
  to?: string,
  granularity: TrendGranularity = "week",
  enabled = true,
  filters?: AnalyticsFilters,
) {
  const { from: f, to: t, qs } = rangeParams(from, to, filters);

  return useQuery({
    queryKey: ["analytics", "trends", f, t, granularity, filters],
    queryFn: () => api.get<TrendsAnalytics>(`/analytics/trends?${qs}&granularity=${granularity}`),
    enabled,
  });
}

export function useAssessmentAnalytics(
  from?: string,
  to?: string,
  enabled = true,
  filters?: AnalyticsFilters,
) {
  const { from: f, to: t, qs } = rangeParams(from, to, filters);

  return useQuery({
    queryKey: ["analytics", "assessments", f, t, filters],
    queryFn: () => api.get<AssessmentAnalytics>(`/analytics/assessments?${qs}`),
    enabled,
  });
}

export function useRoiAnalytics(
  from?: string,
  to?: string,
  enabled = true,
  filters?: AnalyticsFilters,
) {
  const { from: f, to: t, qs } = rangeParams(from, to, filters);

  return useQuery({
    queryKey: ["analytics", "roi", f, t, filters],
    queryFn: () => api.get<RoiAnalytics>(`/analytics/roi?${qs}`),
    enabled,
  });
}

export function useAnalyticsSnapshots(limit = 30, enabled = true) {
  return useQuery({
    queryKey: ["analytics", "snapshots", limit],
    queryFn: () => api.get<AnalyticsDailySnapshot[]>(`/analytics/snapshots?limit=${limit}`),
    enabled,
  });
}

export function useUserAnalytics(userId: string) {
  return useQuery({
    queryKey: ["analytics", "user", userId],
    queryFn: () =>
      api.get<{ courses: Array<{ courseId: string; title: string; progressPercent: number; status: string }> }>(
        `/analytics/users/${userId}`,
      ),
    enabled: !!userId,
  });
}

export function useAnalytics(params?: { from?: string; to?: string; enabled?: boolean; filters?: AnalyticsFilters }) {
  const dashboard = useAnalyticsDashboard(params?.from, params?.to, params?.enabled ?? true, params?.filters);
  return { dashboard };
}

export const useOrgLevelAnalytics = useAnalyticsByOrgLevel;
