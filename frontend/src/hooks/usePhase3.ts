"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, apiGetBlob } from "@/lib/api-client";
import type { AuditLogEntry, Paginated, SkillsAnalytics } from "@/types";

export interface Skill {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  category?: string | null;
  courseCount?: number;
  roleCount?: number;
}

export interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

export interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  lastDeliveryAt: string | null;
  createdAt: string;
}

export interface XapiStats {
  total: number;
  verbs: Array<{ verb: string; count: number }>;
}

export function useSkillsAnalytics(enabled = true) {
  return useQuery({
    queryKey: ["analytics", "skills"],
    queryFn: () => api.get<SkillsAnalytics>("/analytics/skills"),
    enabled,
  });
}

export function useSkills(enabled = true) {
  return useQuery({
    queryKey: ["skills"],
    queryFn: () => api.get<Skill[]>("/skills"),
    enabled,
  });
}

export function useCreateSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; code?: string; category?: string }) =>
      api.post<Skill>("/skills", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "skills"] });
      toast.success("Skill created");
    },
    onError: () => toast.error("Failed to create skill"),
  });
}

export function useDeleteSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/skills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "skills"] });
      toast.success("Skill deleted");
    },
    onError: () => toast.error("Failed to delete skill"),
  });
}

export function useAuditLogs(params?: { page?: number; action?: string }, enabled = true) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.action) search.set("action", params.action);
  const qs = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => api.get<Paginated<AuditLogEntry>>(`/audit-logs${qs}`),
    enabled,
  });
}

export function useApiKeys(enabled = true) {
  return useQuery({
    queryKey: ["integrations", "api-keys"],
    queryFn: () => api.get<ApiKeyRow[]>("/integrations/api-keys"),
    enabled,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; scopes: string[] }) =>
      api.post<ApiKeyRow & { secret: string }>("/integrations/api-keys", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "api-keys"] });
    },
    onError: () => toast.error("Failed to create API key"),
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "api-keys"] });
      toast.success("API key revoked");
    },
    onError: () => toast.error("Failed to revoke API key"),
  });
}

export function useWebhooks(enabled = true) {
  return useQuery({
    queryKey: ["integrations", "webhooks"],
    queryFn: () => api.get<WebhookRow[]>("/integrations/webhooks"),
    enabled,
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { url: string; events: string[] }) =>
      api.post<WebhookRow & { secret: string }>("/integrations/webhooks", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "webhooks"] });
    },
    onError: () => toast.error("Failed to create webhook"),
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/webhooks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "webhooks"] });
      toast.success("Webhook deleted");
    },
    onError: () => toast.error("Failed to delete webhook"),
  });
}

export function useXapiStats(from?: string, to?: string, enabled = true) {
  const search = new URLSearchParams();
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  const qs = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: ["xapi", "stats", from, to],
    queryFn: () => api.get<XapiStats>(`/xapi/stats${qs}`),
    enabled,
  });
}

export function useXapiStatements(params?: { page?: number; verb?: string }, enabled = true) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.verb) search.set("verb", params.verb);
  const qs = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: ["xapi", "statements", params],
    queryFn: () =>
      api.get<Paginated<{ id: string; verb: string; activityId: string | null; userId: string | null; createdAt: string }>>(
        `/xapi/statements${qs}`,
      ),
    enabled,
  });
}

export function useOrgRoles(enabled = true) {
  return useQuery({
    queryKey: ["skills", "roles"],
    queryFn: () =>
      api.get<Array<{ id: string; name: string; isSystem: boolean; userCount: number; skillCount: number }>>(
        "/skills/roles",
      ),
    enabled,
  });
}

export function useRoleSkills(roleId: string, enabled = true) {
  return useQuery({
    queryKey: ["skills", "roles", roleId, "skills"],
    queryFn: () =>
      api.get<Array<{ skillId: string; requiredLevel: number; name: string; category?: string | null }>>(
        `/skills/roles/${roleId}/skills`,
      ),
    enabled: enabled && !!roleId,
  });
}

export function useSetRoleSkills(roleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skills: Array<{ skillId: string; requiredLevel?: number }>) =>
      api.put(`/skills/roles/${roleId}/skills`, { skills }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "roles", roleId, "skills"] });
      queryClient.invalidateQueries({ queryKey: ["skills", "roles"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "skills"] });
      toast.success("Role requirements updated");
    },
    onError: () => toast.error("Failed to update role requirements"),
  });
}

export function useSetCourseSkills(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skills: Array<{ skillId: string; level?: number }>) =>
      api.put<Array<{ skillId: string; level: number; name: string }>>(`/courses/${courseId}/skills`, { skills }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", courseId, "skills"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "skills"] });
      toast.success("Course skills updated");
    },
    onError: () => toast.error("Failed to update course skills"),
  });
}

export function useCourseSkills(courseId: string, enabled = true) {
  return useQuery({
    queryKey: ["courses", courseId, "skills"],
    queryFn: () => api.get<Array<{ skillId: string; level: number; name: string }>>(`/courses/${courseId}/skills`),
    enabled: enabled && !!courseId,
  });
}

export function useExportCompliancePackage() {
  return useMutation({
    mutationFn: async (params?: { from?: string; to?: string }) => {
      const search = new URLSearchParams();
      if (params?.from) search.set("from", params.from);
      if (params?.to) search.set("to", params.to);
      const qs = search.toString();
      const blob = await apiGetBlob(`/compliance/export${qs ? `?${qs}` : ""}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `compliance-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success("Compliance package downloaded"),
    onError: () => toast.error("Failed to export compliance package"),
  });
}
