"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api-client";
import type { Organization } from "@/types";

export function useOrganization() {
  return useQuery({
    queryKey: ["organization", "current"],
    queryFn: () => api.get<Organization>("/organizations/current"),
  });
}

export function useUploadCertificateAsset() {
  return useMutation({
    mutationFn: (body: { kind: "logo" | "signature" | "background"; dataUrl: string }) =>
      api.post<{ kind: string; url: string; path: string }>(
        "/organizations/current/certificate-assets",
        body,
      ),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  const { refreshMe } = useAuth();
  return useMutation({
    mutationFn: (body: { name?: string; settings?: Organization["settings"] }) =>
      api.patch<Organization>("/organizations/current", body),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "current"] });
      await refreshMe();
      toast.success("Organization updated");
    },
    onError: () => toast.error("Failed to update organization"),
  });
}
