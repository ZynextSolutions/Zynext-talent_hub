"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { BankQuestion, QuestionBank, QuestionType } from "@/types";

type BankQuestionWriteBody = {
  question?: string;
  prompt?: string;
  type?: QuestionType;
  options?: string[];
  correctOptionIndex?: number;
  correctOptionIndices?: number[];
  tags?: string[];
  points?: number;
  explanation?: string;
  blanks?: Array<{ acceptableAnswers: string[] }>;
  pairs?: Array<{ left: string; right: string }>;
  minWords?: number;
  maxWords?: number;
};

export function useQuestionBanks() {
  return useQuery({
    queryKey: ["question-banks"],
    queryFn: () => api.get<QuestionBank[]>("/question-banks"),
  });
}

export function useQuestionBank(id: string | undefined) {
  return useQuery({
    queryKey: ["question-banks", id],
    queryFn: () => api.get<QuestionBank>(`/question-banks/${id}`),
    enabled: !!id,
  });
}

export function useCreateQuestionBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      api.post<QuestionBank>("/question-banks", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-banks"] });
      toast.success("Question bank created");
    },
    onError: () => toast.error("Failed to create question bank"),
  });
}

export function useUpdateBankQuestion(bankId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionId,
      ...body
    }: BankQuestionWriteBody & { questionId: string }) =>
      api.patch<BankQuestion>(`/question-banks/${bankId}/questions/${questionId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-banks"] });
      queryClient.invalidateQueries({ queryKey: ["question-banks", bankId] });
      toast.success("Question updated");
    },
    onError: () => toast.error("Failed to update question"),
  });
}

export function useAddBankQuestion(bankId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BankQuestionWriteBody & { question: string }) =>
      api.post<BankQuestion>(`/question-banks/${bankId}/questions`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-banks"] });
      queryClient.invalidateQueries({ queryKey: ["question-banks", bankId] });
      toast.success("Question added");
    },
    onError: () => toast.error("Failed to add question"),
  });
}

export function useDeleteBankQuestion(bankId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) =>
      api.delete(`/question-banks/${bankId}/questions/${questionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-banks"] });
      queryClient.invalidateQueries({ queryKey: ["question-banks", bankId] });
      toast.success("Question removed");
    },
    onError: () => toast.error("Failed to remove question"),
  });
}

export function useUpdateQuestionBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; description?: string }) =>
      api.patch<QuestionBank>(`/question-banks/${id}`, body),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["question-banks"] });
      queryClient.invalidateQueries({ queryKey: ["question-banks", id] });
      toast.success("Question bank updated");
    },
    onError: () => toast.error("Failed to update question bank"),
  });
}

export function useDeleteQuestionBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/question-banks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-banks"] });
      toast.success("Question bank deleted");
    },
    onError: () => toast.error("Failed to delete question bank"),
  });
}
