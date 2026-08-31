"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { AssignPathResult, LearningPath, PathAssignment, PathEnrollment, PathLearnerProgress } from "@/types";

export function useLearningPaths(status?: string) {
  const qs = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["learning-paths", status],
    queryFn: () => api.get<LearningPath[]>(`/learning-paths${qs}`),
  });
}

export function useLearningPath(id: string | undefined) {
  return useQuery({
    queryKey: ["learning-paths", id],
    queryFn: () => api.get<LearningPath>(`/learning-paths/${id}`),
    enabled: !!id,
  });
}

export function useMyPathEnrollments() {
  return useQuery({
    queryKey: ["learning-paths", "my"],
    queryFn: () => api.get<PathEnrollment[]>("/learning-paths/my"),
  });
}

export function usePathLearnerProgress(pathId: string | undefined) {
  return useQuery({
    queryKey: ["learning-paths", pathId, "learner-progress"],
    queryFn: () => api.get<PathLearnerProgress>(`/learning-paths/${pathId}/learner-progress`),
    enabled: !!pathId,
  });
}

export function useCreateLearningPath() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; description?: string }) =>
      api.post<LearningPath>("/learning-paths", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning-paths"] });
      toast.success("Learning path created");
    },
    onError: () => toast.error("Failed to create learning path"),
  });
}

export function useSetPathCourses(pathId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courses: Array<{ courseId: string; orderIndex: number; required?: boolean }>) =>
      api.put<LearningPath>(`/learning-paths/${pathId}/courses`, { courses }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning-paths"] });
      queryClient.invalidateQueries({ queryKey: ["learning-paths", pathId] });
      toast.success("Path courses updated");
    },
    onError: () => toast.error("Failed to update path courses"),
  });
}

export function usePublishLearningPath() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pathId: string) => api.post<LearningPath>(`/learning-paths/${pathId}/publish`),
    onSuccess: (_, pathId) => {
      queryClient.invalidateQueries({ queryKey: ["learning-paths"] });
      queryClient.invalidateQueries({ queryKey: ["learning-paths", pathId] });
      toast.success("Learning path published");
    },
    onError: () => toast.error("Failed to publish path"),
  });
}

export function useEnrollLearningPath(pathId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, pathId: overrideId }: { userId: string; pathId?: string }) => {
      const id = overrideId ?? pathId;
      if (!id) throw new Error("pathId is required");
      return api.post<PathEnrollment>(`/learning-paths/${id}/enroll`, { userId });
    },
    onSuccess: (_, { pathId: overrideId }) => {
      const id = overrideId ?? pathId;
      queryClient.invalidateQueries({ queryKey: ["learning-paths"] });
      queryClient.invalidateQueries({ queryKey: ["learning-paths", "my"] });
      if (id) {
        queryClient.invalidateQueries({ queryKey: ["learning-paths", id] });
        queryClient.invalidateQueries({ queryKey: ["learning-paths", id, "enrollments"] });
        queryClient.invalidateQueries({ queryKey: ["learning-paths", id, "learner-progress"] });
      }
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Enrolled in learning path");
    },
    onError: () => toast.error("Failed to enroll in path"),
  });
}

export function useUpdateLearningPath(pathId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { title?: string; description?: string; status?: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) =>
      api.patch<LearningPath>(`/learning-paths/${pathId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning-paths"] });
      queryClient.invalidateQueries({ queryKey: ["learning-paths", pathId] });
      toast.success("Learning path updated");
    },
    onError: () => toast.error("Failed to update path"),
  });
}

export function useDeleteLearningPath() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/learning-paths/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning-paths"] });
      toast.success("Learning path deleted");
    },
    onError: () => toast.error("Failed to delete path"),
  });
}

export function usePathEnrollments(pathId: string) {
  return useQuery({
    queryKey: ["learning-paths", pathId, "enrollments"],
    queryFn: () => api.get<PathEnrollment[]>(`/learning-paths/${pathId}/enrollments`),
    enabled: !!pathId,
  });
}

export function usePathAssignments(pathId: string) {
  return useQuery({
    queryKey: ["learning-paths", pathId, "assignments"],
    queryFn: () => api.get<PathAssignment[]>(`/learning-paths/${pathId}/assignments`),
    enabled: !!pathId,
  });
}

export function useAssignLearningPath(pathId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      targetType: "ORGANIZATION" | "DIVISION" | "DEPARTMENT" | "TEAM" | "USER";
      targetId: string;
    }) => api.post<AssignPathResult>(`/learning-paths/${pathId}/assign`, body, { idempotent: true }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["learning-paths"] });
      queryClient.invalidateQueries({ queryKey: ["learning-paths", pathId] });
      queryClient.invalidateQueries({ queryKey: ["learning-paths", pathId, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["learning-paths", pathId, "enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      const parts = [
        `${data.enrolledCount} newly enrolled`,
        data.alreadyEnrolledCount ? `${data.alreadyEnrolledCount} already enrolled` : null,
        data.skippedInactiveCount ? `${data.skippedInactiveCount} skipped (inactive)` : null,
      ].filter(Boolean);
      toast.success(
        data.created ? `Path assigned — ${parts.join(", ")}` : `Assignment updated — ${parts.join(", ")}`,
      );
    },
    onError: () => toast.error("Failed to assign learning path"),
  });
}
