"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api-client";
import type { MfaSetupResponse } from "@/types";

export function useMfaSetup() {
  return useMutation({
    mutationFn: () => api.post<MfaSetupResponse>("/auth/mfa/setup"),
    onError: (err: Error) => toast.error(err.message || "MFA setup is not available yet"),
  });
}

export function useMfaVerify() {
  const { refreshMe } = useAuth();
  return useMutation({
    mutationFn: (code: string) => api.post<{ enabled: boolean }>("/auth/mfa/verify", { code }),
    onSuccess: async () => {
      await refreshMe();
      toast.success("Two-factor authentication enabled");
    },
    onError: (err: Error) => toast.error(err.message || "Invalid verification code"),
  });
}

export function useMfaDisable() {
  const { refreshMe } = useAuth();
  return useMutation({
    mutationFn: (body: { code: string; password: string }) =>
      api.post<{ disabled: boolean }>("/auth/mfa/disable", body),
    onSuccess: async () => {
      await refreshMe();
      toast.success("Two-factor authentication disabled");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to disable MFA"),
  });
}
