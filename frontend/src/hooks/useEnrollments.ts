"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { Enrollment, Paginated } from "@/types";

export function useEnrollments(params?: {
  courseId?: string;
  userId?: string;
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const search = new URLSearchParams();
  if (params?.courseId) search.set("courseId", params.courseId);
  if (params?.userId) search.set("userId", params.userId);
  if (params?.status) search.set("status", params.status);
  if (params?.q) search.set("q", params.q);
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  const qs = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: ["enrollments", params],
    queryFn: () => api.get<Paginated<Enrollment>>(`/enrollments${qs}`),
    placeholderData: keepPreviousData,
  });
}

export function useCreateEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { userId: string; courseId: string; dueAt?: string | null }) =>
      api.post<Enrollment>("/enrollments", body, { idempotent: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Enrollment created");
    },
    onError: () => toast.error("Failed to create enrollment"),
  });
}

export function useRevokeEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/enrollments/${id}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Enrollment revoked");
    },
    onError: () => toast.error("Failed to revoke enrollment"),
  });
}
