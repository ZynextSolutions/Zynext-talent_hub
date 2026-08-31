"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ComplianceAnalytics } from "@/types";

export function useComplianceAnalytics(enabled = true, page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ["analytics", "compliance", page, pageSize],
    queryFn: () =>
      api.get<ComplianceAnalytics>(`/analytics/compliance?page=${page}&pageSize=${pageSize}`),
    enabled,
  });
}
