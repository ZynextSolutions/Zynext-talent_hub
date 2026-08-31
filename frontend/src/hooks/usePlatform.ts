"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { AuditLogEntry, Paginated, PlatformOrganization } from "@/types";

export function usePlatformOrganizations(params?: { page?: number; pageSize?: number; q?: string; status?: string }) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.q) search.set("q", params.q);
  if (params?.status) search.set("status", params.status);
  const qs = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: ["platform", "organizations", params],
    queryFn: () => api.get<Paginated<PlatformOrganization>>(`/platform/organizations${qs}`),
  });
}

export function usePlatformAuditLogs(params?: { page?: number; organizationId?: string }) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.organizationId) search.set("organizationId", params.organizationId);
  const qs = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: ["platform", "audit-logs", params],
    queryFn: () => api.get<Paginated<AuditLogEntry>>(`/platform/audit-logs${qs}`),
  });
}

export function useCreatePlatformOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      slug: string;
      adminEmail: string;
      adminFirstName: string;
      adminLastName: string;
    }) =>
      api.post<{ organization: PlatformOrganization; invite: { email: string; token: string } }>(
        "/platform/organizations",
        body
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
      toast.success(`Organization created — invite sent to ${data.invite.email}`);
    },
    onError: () => toast.error("Failed to create organization"),
  });
}

export function usePatchPlatformOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; status?: "ACTIVE" | "SUSPENDED" }) =>
      api.patch<PlatformOrganization>(`/platform/organizations/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
      toast.success("Organization updated");
    },
    onError: () => toast.error("Failed to update organization"),
  });
}

export function useDeletePlatformOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/platform/organizations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
      toast.success("Organization deleted");
    },
    onError: () => toast.error("Failed to delete organization"),
  });
}
