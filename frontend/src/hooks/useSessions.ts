"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { SessionRegistration, TrainingSession } from "@/types";

export function useCourseSessions(courseId: string, lessonId?: string) {
  const qs = lessonId ? `?lessonId=${lessonId}` : "";
  return useQuery({
    queryKey: ["sessions", courseId, lessonId],
    queryFn: () => api.get<TrainingSession[]>(`/courses/${courseId}/sessions${qs}`),
    enabled: !!courseId,
  });
}

export function useSessionRegistrations(courseId: string, sessionId: string, enabled = true) {
  return useQuery({
    queryKey: ["sessions", courseId, sessionId, "registrations"],
    queryFn: () =>
      api.get<SessionRegistration[]>(`/courses/${courseId}/sessions/${sessionId}/registrations`),
    enabled: enabled && !!courseId && !!sessionId,
  });
}

export function useCreateSession(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      lessonId: string;
      title: string;
      description?: string;
      deliveryMode: "ILT" | "VILT";
      startsAt: string;
      endsAt: string;
      timezone?: string;
      location?: string | null;
      meetingUrl?: string | null;
      capacity?: number | null;
    }) => api.post<TrainingSession>(`/courses/${courseId}/sessions`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions", courseId] });
      toast.success("Session scheduled");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create session"),
  });
}

export function useRegisterSession(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.post<SessionRegistration>(`/courses/${courseId}/sessions/${sessionId}/register`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions", courseId] });
      toast.success("Registered for session");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to register"),
  });
}

export function useMarkSessionAttendance(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      userIds,
      status,
    }: {
      sessionId: string;
      userIds: string[];
      status: "ATTENDED" | "NO_SHOW";
    }) =>
      api.post(`/courses/${courseId}/sessions/${sessionId}/attendance`, { userIds, status }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["sessions", courseId] });
      queryClient.invalidateQueries({
        queryKey: ["sessions", courseId, vars.sessionId, "registrations"],
      });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Attendance updated");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to update attendance"),
  });
}

export function useDeleteSession(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.delete(`/courses/${courseId}/sessions/${sessionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions", courseId] });
      toast.success("Session deleted");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to delete session"),
  });
}
