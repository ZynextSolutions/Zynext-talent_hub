"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { BulkUserStatusResult, Paginated, User, UserImportResult, UserRole, UserStatus } from "@/types";

export interface UsersQueryParams {
  page?: number;
  pageSize?: number;
  q?: string;
  role?: UserRole;
  status?: UserStatus;
}

export function useUsers(params?: UsersQueryParams) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize ?? 50));
  if (params?.q) search.set("q", params.q);
  if (params?.role) search.set("role", params.role);
  if (params?.status) search.set("status", params.status);
  const qs = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: ["users", params],
    queryFn: () => api.get<Paginated<User>>(`/users${qs}`),
  });
}

export interface InviteUserInput {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  teamId: string;
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: InviteUserInput) => api.post<User>("/users", body),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(`Invite sent to ${user.email}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to invite user");
    },
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<User>(`/users/${id}/suspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User suspended");
    },
    onError: () => toast.error("Failed to suspend user"),
  });
}

export function useResendInvite() {
  return useMutation({
    mutationFn: (id: string) => api.post<{ sent: boolean }>(`/users/${id}/resend-invite`),
    onSuccess: () => toast.success("Invite resent"),
    onError: () => toast.error("Failed to resend invite"),
  });
}

export function useActivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<User>(`/users/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User activated");
    },
    onError: () => toast.error("Failed to activate user"),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      firstName?: string;
      lastName?: string;
      role?: UserRole;
      teamId?: string;
      status?: UserStatus;
    }) => api.patch<User>(`/users/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated");
    },
    onError: () => toast.error("Failed to update user"),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deleted");
    },
    onError: () => toast.error("Failed to delete user"),
  });
}

export function useUnlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<User>(`/users/${id}/unlock`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User unlocked");
    },
    onError: () => toast.error("Failed to unlock user"),
  });
}

export function useBulkUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { userIds: string[]; status: UserStatus }) =>
      api.post<BulkUserStatusResult>("/users/bulk-status", body),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(`${result.updated} user(s) updated`);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update users"),
  });
}

export function useExportUsers() {
  return useMutation({
    mutationFn: async () => {
      const blob = await api.getBlob("/users/export");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success("Users exported"),
    onError: (err: Error) => toast.error(err.message || "Failed to export users"),
  });
}

export function useImportUsers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadForm<UserImportResult>("/users/import", file),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      const parts = [`${result.created} created`, `${result.updated} updated`];
      if (result.skipped) parts.push(`${result.skipped} skipped`);
      toast.success(`Import complete: ${parts.join(", ")}`);
      if (result.errors?.length) {
        toast.warning(`${result.errors.length} row(s) had errors`);
      }
    },
    onError: (err: Error) => toast.error(err.message || "Failed to import users"),
  });
}
