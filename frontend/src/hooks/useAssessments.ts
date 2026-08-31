"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, apiGetBlob } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import type {
  Assessment,
  AssessmentAttempt,
  AssessmentAttemptReview,
  AssessmentStartResult,
  AssessmentSubmitResult,
  PendingReviewAttempt,
} from "@/types";

export function useCourseAssessments(courseId: string) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  return useQuery({
    queryKey: ["assessments", "course", courseId],
    queryFn: () => api.get<Assessment[]>(`/courses/${courseId}/assessments`),
    enabled: !!courseId && !authLoading && isAuthenticated,
  });
}

export function useAssessment(id: string | undefined) {
  return useQuery({
    queryKey: ["assessments", id],
    queryFn: () => api.get<Assessment>(`/assessments/${id}`),
    enabled: !!id,
  });
}

export function useAssessmentAttempts(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ["assessments", assessmentId, "attempts"],
    queryFn: () => api.get<AssessmentAttempt[]>(`/assessments/${assessmentId}/attempts`),
    enabled: !!assessmentId,
  });
}

export function useAttemptReview(assessmentId: string | undefined, attemptId: string | undefined) {
  return useQuery({
    queryKey: ["assessments", assessmentId, "attempts", attemptId, "review"],
    queryFn: () =>
      api.get<AssessmentAttemptReview>(`/assessments/${assessmentId}/attempts/${attemptId}/review`),
    enabled: !!assessmentId && !!attemptId,
  });
}

export function usePendingReviewAttempts() {
  return useQuery({
    queryKey: ["assessments", "pending-review"],
    queryFn: () => api.get<PendingReviewAttempt[]>("/assessments/pending-review"),
  });
}

export function useUpdateAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      courseId,
      ...body
    }: {
      id: string;
      courseId: string;
      title?: string;
      passingScore?: number;
      maxAttempts?: number | null;
      timeLimitSeconds?: number | null;
      bankId?: string | null;
      drawCount?: number | null;
      drawTags?: string[];
      questions?: Array<{
        prompt: string;
        type?: "MCQ" | "TRUE_FALSE" | "MULTI_SELECT" | "SHORT_ANSWER" | "FILL_BLANK" | "MATCHING" | "ESSAY";
        options?: string[];
        correctOptionIndex?: number;
        correctOptionIndices?: number[];
        points?: number;
        explanation?: string;
        blanks?: Array<{ acceptableAnswers: string[] }>;
        pairs?: Array<{ left: string; right: string }>;
        minWords?: number;
        maxWords?: number;
      }>;
    }) => api.patch<Assessment>(`/assessments/${id}`, body),
    onSuccess: (_, { courseId, id }) => {
      queryClient.invalidateQueries({ queryKey: ["assessments", "course", courseId] });
      queryClient.invalidateQueries({ queryKey: ["assessments", id] });
      toast.success("Assessment updated");
    },
    onError: () => toast.error("Failed to update assessment"),
  });
}

export function useCreateAssessment(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      kind?: "PRE" | "FINAL" | "SURVEY" | "MODULE_QUIZ";
      passingScore?: number;
      maxAttempts?: number | null;
      timeLimitSeconds?: number | null;
      bankId?: string | null;
      drawCount?: number | null;
      drawTags?: string[];
      lessonId?: string | null;
      anonymous?: boolean;
      questions?: Array<{
        prompt: string;
        type?: "MCQ" | "TRUE_FALSE" | "MULTI_SELECT" | "SHORT_ANSWER" | "FILL_BLANK" | "MATCHING" | "ESSAY";
        options?: string[];
        correctOptionIndex?: number;
        correctOptionIndices?: number[];
        points?: number;
        explanation?: string;
        blanks?: Array<{ acceptableAnswers: string[] }>;
        pairs?: Array<{ left: string; right: string }>;
        minWords?: number;
        maxWords?: number;
      }>;
    }) => api.post<Assessment>(`/courses/${courseId}/assessments`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessments", "course", courseId] });
      toast.success("Assessment created");
    },
    onError: () => toast.error("Failed to create assessment"),
  });
}

export function useStartAssessment(assessmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { enrollmentId: string }) =>
      api.post<AssessmentStartResult>(`/assessments/${assessmentId}/start`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessments", assessmentId] });
    },
    onError: () => toast.error("Failed to start assessment"),
  });
}

export function useExpireAssessment(assessmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { enrollmentId: string }) =>
      api.post<{ attempt: AssessmentAttempt }>(`/assessments/${assessmentId}/expire`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessments", assessmentId] });
      queryClient.invalidateQueries({ queryKey: ["assessments", assessmentId, "attempts"] });
    },
  });
}

export function useSubmitAssessment(assessmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      enrollmentId: string;
      attemptId?: string;
      answers: Array<{
        questionId: string;
        optionId?: string;
        optionIds?: string[];
        text?: string;
        blanks?: Array<{ blankId: string; text: string }>;
        matches?: Array<{ leftId: string; rightId: string }>;
      }>;
    }) => api.post<AssessmentSubmitResult & { pendingReview?: boolean; survey?: boolean }>(`/assessments/${assessmentId}/submit`, body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["assessments", assessmentId] });
      queryClient.invalidateQueries({ queryKey: ["assessments", assessmentId, "attempts"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      queryClient.invalidateQueries({ queryKey: ["assessments", "pending-review"] });
      if (data.survey) {
        toast.success("Thank you for your responses");
      } else if (data.pendingReview) {
        toast.info("Submitted for instructor review");
      } else if (data.attempt.passed) {
        toast.success(`Passed with ${data.attempt.score ?? 0}%`);
      } else {
        toast.error(`Score ${data.attempt.score ?? 0}% — not passing`);
      }
    },
    onError: () => toast.error("Failed to submit assessment"),
  });
}

export function useGradeAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      attemptId,
      ...body
    }: {
      attemptId: string;
      score: number;
      passed: boolean;
      instructorFeedback?: string;
    }) => api.patch(`/assessments/attempts/${attemptId}/grade`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessments", "pending-review"] });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      toast.success("Attempt graded");
    },
    onError: () => toast.error("Failed to grade attempt"),
  });
}

export function useDeleteAssessment(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/assessments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessments", "course", courseId] });
      toast.success("Assessment removed");
    },
    onError: () => toast.error("Failed to remove assessment"),
  });
}

export async function downloadSurveyExport(assessmentId: string, filename: string) {
  const blob = await apiGetBlob(`/assessments/${assessmentId}/survey-export`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
