"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { ForumPost, ForumThread, Paginated } from "@/types";

export function useOrgForumThreads(page = 1) {
  return useQuery({
    queryKey: ["forums", "org", page],
    queryFn: () => api.get<Paginated<ForumThread>>(`/forums/threads?page=${page}&pageSize=20`),
  });
}

export function useCourseForumThreads(courseId: string, page = 1) {
  return useQuery({
    queryKey: ["forums", "course", courseId, page],
    queryFn: () =>
      api.get<Paginated<ForumThread>>(`/courses/${courseId}/forum/threads?page=${page}&pageSize=20`),
    enabled: !!courseId,
  });
}

export function useForumThread(threadId: string) {
  return useQuery({
    queryKey: ["forums", "thread", threadId],
    queryFn: () => api.get<{ thread: ForumThread; posts: ForumPost[] }>(`/forums/threads/${threadId}`),
    enabled: !!threadId,
  });
}

export function useCreateForumThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      scope: "ORGANIZATION" | "COURSE";
      courseId?: string;
      lessonId?: string;
      title: string;
      body: string;
    }) =>
      input.scope === "ORGANIZATION"
        ? api.post<ForumThread>("/forums/threads", { title: input.title, body: input.body })
        : api.post<ForumThread>(`/courses/${input.courseId}/forum/threads`, {
            title: input.title,
            body: input.body,
            lessonId: input.lessonId,
          }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["forums"] });
      toast.success("Discussion started");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create thread"),
  });
}

export function useCreateForumPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, body }: { threadId: string; body: string }) =>
      api.post<ForumPost>(`/forums/threads/${threadId}/posts`, { body }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["forums", "thread", vars.threadId] });
      queryClient.invalidateQueries({ queryKey: ["forums"] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to post reply"),
  });
}
