"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { api, apiUploadBinary } from "@/lib/api-client";
import type { User } from "@/types";

export function useUpdateProfile() {
  const { refreshMe } = useAuth();
  return useMutation({
    mutationFn: (body: { firstName?: string; lastName?: string; avatarUrl?: string | null }) =>
      api.patch<User>("/auth/me", body),
    onSuccess: async () => {
      await refreshMe();
      toast.success("Profile updated");
    },
    onError: () => toast.error("Failed to update profile"),
  });
}

export function useUploadAvatar() {
  const { refreshMe } = useAuth();
  return useMutation({
    mutationFn: (file: File) =>
      apiUploadBinary<{ avatarUrl: string; user: User }>(
        "/auth/me/avatar",
        file,
        { "X-Filename": encodeURIComponent(file.name) },
      ),
    onSuccess: async () => {
      await refreshMe();
      toast.success("Avatar updated");
    },
    onError: () => toast.error("Failed to upload avatar"),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.post<{ changed: boolean }>("/auth/change-password", body),
    onSuccess: () => toast.success("Password changed"),
    onError: () => toast.error("Failed to change password"),
  });
}
