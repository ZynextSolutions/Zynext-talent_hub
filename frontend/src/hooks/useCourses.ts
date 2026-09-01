"use client";

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiClientError, apiUploadBinary } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import type {
  CatalogCourse,
  Course,
  CourseDetail,
  CourseModule,
  CoursePrerequisiteSummary,
  CourseRevisionDetail,
  CourseRevisionSummary,
  Lesson,
  LessonKind,
  Paginated,
} from "@/types";

export interface CourseAssignment {
  id: string;
  organizationId?: string;
  courseId?: string;
  targetType: string;
  targetId: string;
  createdByUserId?: string | null;
  dueAt?: string | null;
  recertifyEveryDays?: number | null;
  reminderDaysBefore?: number | null;
  createdAt?: string;
}

export interface AssignCourseResult {
  assignment: CourseAssignment;
  enrolledCount: number;
  alreadyEnrolledCount: number;
  skippedInactiveCount: number;
  created: boolean;
  replay?: boolean;
}

export function useCourses(params?: { page?: number; pageSize?: number; q?: string; status?: string }) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.q) search.set("q", params.q);
  if (params?.status) search.set("status", params.status);
  const qs = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: ["courses", params],
    queryFn: () => api.get<Paginated<Course>>(`/courses${qs}`),
    placeholderData: keepPreviousData,
  });
}

export function useCourseCatalog(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  availability?: "open" | "upcoming";
  enrolled?: boolean;
  prerequisitesMet?: boolean;
  duration?: "short" | "medium" | "long";
}) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.q) search.set("q", params.q);
  if (params?.availability) search.set("availability", params.availability);
  if (params?.enrolled === true) search.set("enrolled", "true");
  if (params?.enrolled === false) search.set("enrolled", "false");
  if (params?.prerequisitesMet) search.set("prerequisitesMet", "true");
  if (params?.duration) search.set("duration", params.duration);
  const qs = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: ["courses", "catalog", params],
    queryFn: () => api.get<Paginated<CatalogCourse>>(`/courses/catalog${qs}`),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateCoursePrerequisites(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prerequisiteCourseIds: string[]) =>
      api.put<CoursePrerequisiteSummary[]>(`/courses/${courseId}/prerequisites`, {
        prerequisiteCourseIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
      toast.success("Prerequisites updated");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to update prerequisites"),
  });
}

export function useSelfEnrollCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) =>
      api.post<{ enrollment: { id: string; courseId: string }; created: boolean }>(
        `/courses/${courseId}/enroll`,
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success(data.created ? "Enrolled in course" : "Already enrolled");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to enroll"),
  });
}

export function useToggleCourseFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, favorited }: { courseId: string; favorited: boolean }) =>
      favorited
        ? api.delete<{ favorited: boolean }>(`/courses/${courseId}/favorite`)
        : api.post<{ favorited: boolean }>(`/courses/${courseId}/favorite`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["courses", "catalog"] });
      toast.success(variables.favorited ? "Removed from favorites" : "Added to favorites");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to update favorite"),
  });
}

export function useCourse(id: string) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  return useQuery({
    queryKey: ["courses", id],
    queryFn: () => api.get<CourseDetail>(`/courses/${id}`),
    enabled: !!id && !authLoading && isAuthenticated,
  });
}

export function useCourseLessons(courseId: string) {
  return useQuery({
    queryKey: ["courses", courseId, "lessons"],
    queryFn: () => api.get<Lesson[]>(`/courses/${courseId}/lessons`),
    enabled: !!courseId,
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; description?: string; durationMinutes?: number }) =>
      api.post<Course>("/courses", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course created");
    },
    onError: () => toast.error("Failed to create course"),
  });
}

export function useCreateLesson(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      description?: string;
      kind?: LessonKind;
      content?: string;
      videoUrl?: string | null;
      resourceUrl?: string | null;
      durationSeconds?: number;
      order?: number;
      moduleId?: string | null;
    }) => api.post<Lesson>(`/courses/${courseId}/lessons`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
      toast.success("Lesson added");
    },
    onError: () => toast.error("Failed to add lesson"),
  });
}

export function useAssignCourse(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      targetType: "ORGANIZATION" | "DIVISION" | "DEPARTMENT" | "TEAM" | "USER";
      targetId: string;
      dueAt?: string | null;
      recertifyEveryDays?: number | null;
      reminderDaysBefore?: number | null;
    }) => api.post<AssignCourseResult>(`/courses/${courseId}/assign`, body, { idempotent: true }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
      queryClient.invalidateQueries({ queryKey: ["courses", courseId, "assignments"] });
      const parts = [
        `${data.enrolledCount} newly enrolled`,
        data.alreadyEnrolledCount ? `${data.alreadyEnrolledCount} already enrolled` : null,
        data.skippedInactiveCount ? `${data.skippedInactiveCount} skipped (inactive)` : null,
      ].filter(Boolean);
      toast.success(
        data.created ? `Course assigned — ${parts.join(", ")}` : `Assignment updated — ${parts.join(", ")}`,
      );
    },
    onError: () => toast.error("Failed to assign course"),
  });
}

export function usePublishCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Course>(`/courses/${id}/publish`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses", id] });
      queryClient.invalidateQueries({ queryKey: ["courses", id, "revisions"] });
      toast.success("Course published");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to publish course"),
  });
}

export function useArchiveCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Course>(`/courses/${id}/archive`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses", id] });
      toast.success("Course archived");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to archive course"),
  });
}

export function useUnarchiveCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Course>(`/courses/${id}/unarchive`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses", id] });
      toast.success("Course restored to draft");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to unarchive course"),
  });
}

export function useUploadCourseThumbnail(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      apiUploadBinary<Course>(`/courses/${courseId}/thumbnail`, file, {
        "X-Filename": encodeURIComponent(file.name),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
      toast.success("Thumbnail uploaded");
    },
    onError: () => toast.error("Failed to upload thumbnail"),
  });
}

export function useUploadCourseIntroVideo(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      apiUploadBinary<Course>(`/courses/${courseId}/intro-video`, file, {
        "X-Filename": encodeURIComponent(file.name),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
      toast.success("Intro video uploaded");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to upload intro video"),
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      title?: string;
      description?: string | null;
      durationMinutes?: number;
      costCents?: number | null;
      thumbnailUrl?: string | null;
      videoUrl?: string | null;
      availableFrom?: string | null;
      availableUntil?: string | null;
      completionMode?: "ALL_LESSONS" | "REQUIRED_LESSONS" | "PERCENTAGE";
      completionPercent?: number | null;
      requirePreAssessment?: boolean;
    }) => api.patch<Course>(`/courses/${id}`, body),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses", id] });
      toast.success("Course updated");
    },
    onError: () => toast.error("Failed to update course"),
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      api.delete(`/courses/${id}${force ? "?force=true" : ""}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course deleted");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to delete course"),
  });
}

export function useUploadScormPackage(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      apiUploadBinary<{
        course: Course;
        lesson: Lesson;
        launchUrl: string;
        scormVersion: string;
      }>(`/courses/${courseId}/scorm`, file, {
        "X-Filename": encodeURIComponent(file.name),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
      toast.success("SCORM package uploaded");
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Failed to upload SCORM package"),
  });
}

export function useDuplicateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      includeAssignments = false,
    }: {
      id: string;
      includeAssignments?: boolean;
    }) => {
      const qs = includeAssignments ? "?includeAssignments=true" : "";
      return api.post<Course>(`/courses/${id}/duplicate${qs}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course duplicated");
    },
    onError: () => toast.error("Failed to duplicate course"),
  });
}

export function useCourseRevisions(courseId: string) {
  return useQuery({
    queryKey: ["courses", courseId, "revisions"],
    queryFn: () => api.get<CourseRevisionSummary[]>(`/courses/${courseId}/revisions`),
    enabled: !!courseId,
  });
}

export function useCourseRevision(courseId: string, revisionId: string | null) {
  return useQuery({
    queryKey: ["courses", courseId, "revisions", revisionId],
    queryFn: () => api.get<CourseRevisionDetail>(`/courses/${courseId}/revisions/${revisionId}`),
    enabled: !!courseId && !!revisionId,
  });
}

export function useUpdateLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      lessonId,
      courseId,
      ...body
    }: {
      lessonId: string;
      courseId: string;
      title?: string;
      description?: string | null;
      kind?: LessonKind;
      content?: string;
      videoUrl?: string | null;
      resourceUrl?: string | null;
      durationSeconds?: number;
      moduleId?: string | null;
      required?: boolean;
      prerequisiteLessonId?: string | null;
    }) => api.patch<Lesson>(`/lessons/${lessonId}`, body),
    onSuccess: (_, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
      toast.success("Lesson updated");
    },
    onError: () => toast.error("Failed to update lesson"),
  });
}

export function useUploadLessonAsset() {
  return useMutation({
    mutationFn: ({
      lessonId,
      kind,
      file,
    }: {
      lessonId: string;
      courseId: string;
      kind: "video" | "document";
      file: File;
    }) =>
      api.uploadBinary<{ path: string; url: string; lesson: Lesson }>(
        `/lessons/${lessonId}/asset`,
        file,
        {
          "X-Filename": encodeURIComponent(file.name),
          "X-Asset-Kind": kind,
        },
      ),
  });
}

export function useDeleteLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lessonId, courseId }: { lessonId: string; courseId: string }) =>
      api.delete(`/lessons/${lessonId}`),
    onSuccess: (_, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
      toast.success("Lesson removed");
    },
    onError: () => toast.error("Failed to remove lesson"),
  });
}

export function useReorderLessons(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lessonIds: string[]) =>
      api.put(`/courses/${courseId}/lessons/reorder`, { lessonIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
      toast.success("Lessons reordered");
    },
    onError: () => toast.error("Failed to reorder lessons"),
  });
}

export function useCreateModule(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; description?: string | null }) =>
      api.post<CourseModule>(`/courses/${courseId}/modules`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
      toast.success("Module added");
    },
    onError: () => toast.error("Failed to add module"),
  });
}

export function useUpdateModule(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      moduleId,
      ...body
    }: {
      moduleId: string;
      title?: string;
      description?: string | null;
    }) => api.patch<CourseModule>(`/courses/${courseId}/modules/${moduleId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
    },
    onError: () => toast.error("Failed to update module"),
  });
}

export function useDeleteModule(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (moduleId: string) => api.delete(`/courses/${courseId}/modules/${moduleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
      toast.success("Module removed");
    },
    onError: () => toast.error("Failed to remove module"),
  });
}

export function useReorderModules(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (moduleIds: string[]) =>
      api.put(`/courses/${courseId}/modules/reorder`, { moduleIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
    },
    onError: () => toast.error("Failed to reorder modules"),
  });
}

export function useCourseAssignments(courseId: string) {
  return useQuery({
    queryKey: ["courses", courseId, "assignments"],
    queryFn: () => api.get<CourseAssignment[]>(`/courses/${courseId}/assignments`),
    enabled: !!courseId,
  });
}

export function useUnassignCourse(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) =>
      api.delete(`/courses/${courseId}/assignments/${assignmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", courseId, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
      toast.success("Assignment removed");
    },
    onError: () => toast.error("Failed to remove assignment"),
  });
}

export function usePatchAssignment(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      assignmentId,
      ...body
    }: {
      assignmentId: string;
      dueAt?: string | null;
      recertifyEveryDays?: number | null;
      reminderDaysBefore?: number | null;
    }) => api.patch<CourseAssignment>(`/courses/${courseId}/assignments/${assignmentId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", courseId, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
      toast.success("Assignment updated");
    },
    onError: () => toast.error("Failed to update assignment"),
  });
}
