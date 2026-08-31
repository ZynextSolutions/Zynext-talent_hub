"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { Certificate, CertificateVerification, Paginated } from "@/types";

export function useCertificates(params?: { page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  const qs = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: ["certificates", params],
    queryFn: () => api.get<Paginated<Certificate>>(`/certificates${qs}`),
  });
}

export function useVerifyCertificate(number: string) {
  return useQuery({
    queryKey: ["certificates", "verify", number],
    queryFn: () =>
      api.get<CertificateVerification>(`/certificates/number/${encodeURIComponent(number)}`, {
        auth: false,
      }),
    enabled: number.length >= 4,
    retry: false,
  });
}

export function useRevokeCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<Certificate>(`/certificates/${id}/revoke`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      toast.success("Certificate revoked");
    },
    onError: () => toast.error("Failed to revoke certificate"),
  });
}
