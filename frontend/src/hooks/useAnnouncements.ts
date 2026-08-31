"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { Announcement, Paginated } from "@/types";

export function useActiveAnnouncements() {
  return useQuery({
    queryKey: ["announcements", "active"],
    queryFn: () => api.get<Announcement[]>("/announcements/active"),
    refetchInterval: 120_000,
  });
}

export function useAnnouncements(params?: { page?: number; courseId?: string }) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.courseId) search.set("courseId", params.courseId);
  const qs = search.toString() ? `?${search.toString()}` : "";
  return useQuery({
    queryKey: ["announcements", "admin", params],
    queryFn: () => api.get<Paginated<Announcement>>(`/announcements${qs}`),
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      body: string;
      courseId?: string | null;
      publishedAt?: string | null;
      expiresAt?: string | null;
    }) => api.post<Announcement>("/announcements", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Announcement created");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create announcement"),
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Announcement deleted");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to delete announcement"),
  });
}
