"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

export function useCreateDivision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) => api.post("/divisions", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tree"] });
      toast.success("Division created");
    },
    onError: () => toast.error("Failed to create division"),
  });
}

export function useUpdateDivision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch(`/divisions/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tree"] });
      toast.success("Division updated");
    },
    onError: () => toast.error("Failed to update division"),
  });
}

export function useDeleteDivision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/divisions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tree"] });
      toast.success("Division removed");
    },
    onError: () => toast.error("Failed to remove division"),
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; divisionId?: string | null }) =>
      api.post("/departments", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tree"] });
      toast.success("Department created");
    },
    onError: () => toast.error("Failed to create department"),
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch(`/departments/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tree"] });
      toast.success("Department updated");
    },
    onError: () => toast.error("Failed to update department"),
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tree"] });
      toast.success("Department removed");
    },
    onError: () => toast.error("Failed to remove department"),
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; departmentId: string }) => api.post("/teams", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tree"] });
      toast.success("Team created");
    },
    onError: () => toast.error("Failed to create team"),
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch(`/teams/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tree"] });
      toast.success("Team updated");
    },
    onError: () => toast.error("Failed to update team"),
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/teams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tree"] });
      toast.success("Team removed");
    },
    onError: () => toast.error("Failed to remove team"),
  });
}
