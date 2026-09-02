"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { LessonFileField } from "@/components/courses/lesson-file-field";
import { LessonVideoPlayer } from "@/components/courses/lesson-video-player";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeleteLesson, useUpdateLesson, useUploadLessonAsset } from "@/hooks/useCourses";
import { ApiClientError } from "@/lib/api-client";
import { resolveAssetUrl } from "@/lib/certificate-template";
import { formatLessonDuration, LESSON_TYPES, lessonKind, lessonTypeLabel } from "@/lib/course-outline";
import type { Lesson, LessonKind } from "@/types";
import { toast } from "sonner";

interface StudioLessonEditorProps {
  lesson: Lesson;
  courseId: string;
  courseLessons: Lesson[];
  canWrite: boolean;
}

export function StudioLessonEditor({ lesson, courseId, courseLessons, canWrite }: StudioLessonEditorProps) {
  const updateLesson = useUpdateLesson();
  const deleteLesson = useDeleteLesson();
  const uploadAsset = useUploadLessonAsset();
  const [title, setTitle] = useState(lesson.title);
  const [kind, setKind] = useState<LessonKind>(lessonKind(lesson));
  const [description, setDescription] = useState(lesson.description ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl ?? "");
  const [resourceUrl, setResourceUrl] = useState(lesson.resourceUrl ?? "");
  const [content, setContent] = useState(lesson.content ?? "");
  const [required, setRequired] = useState(lesson.required !== false);
  const [prerequisiteLessonId, setPrerequisiteLessonId] = useState(lesson.prerequisiteLessonId ?? "");
  const [durationMinutes, setDurationMinutes] = useState(
    lesson.durationSeconds ? String(Math.round(lesson.durationSeconds / 60)) : "",
  );
  const [previewUrl, setPreviewUrl] = useState(lesson.videoUrl ?? "");

  useEffect(() => {
    setTitle(lesson.title);
    setKind(lessonKind(lesson));
    setDescription(lesson.description ?? "");
    setVideoUrl(lesson.videoUrl ?? "");
    setResourceUrl(lesson.resourceUrl ?? "");
    setContent(lesson.content ?? "");
    setRequired(lesson.required !== false);
    setPrerequisiteLessonId(lesson.prerequisiteLessonId ?? "");
    setDurationMinutes(lesson.durationSeconds ? String(Math.round(lesson.durationSeconds / 60)) : "");
    setPreviewUrl(lesson.videoUrl ?? "");
  }, [lesson]);

  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewUrl(videoUrl.trim()), 800);
    return () => window.clearTimeout(timer);
  }, [videoUrl]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    try {
      await updateLesson.mutateAsync({
        lessonId: lesson.id,
        courseId,
        title: title.trim(),
        kind,
        description: description.trim() || null,
        videoUrl: videoUrl.trim() || null,
        resourceUrl: resourceUrl.trim() || null,
        content: content.trim() || "",
        durationSeconds: durationMinutes ? Number(durationMinutes) * 60 : undefined,
        required,
        prerequisiteLessonId: prerequisiteLessonId || null,
      });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to save lesson");
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wider">
            {lessonTypeLabel(kind)}
            {formatLessonDuration(lesson.durationSeconds) ? ` · ${formatLessonDuration(lesson.durationSeconds)}` : ""}
          </p>
          <h2 className="mt-1 text-xl font-semibold">{lesson.title}</h2>
        </div>
        {canWrite && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              if (confirm("Delete this lesson?")) {
                deleteLesson.mutate({ lessonId: lesson.id, courseId });
              }
            }}
          >
            <Trash2 />
            Delete
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label>Lesson type</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {LESSON_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              disabled={!canWrite}
              onClick={() => setKind(type.id)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                kind === type.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
              }`}
            >
              <span className="block font-medium">{type.label}</span>
              <span className="text-muted-foreground block text-[11px] leading-snug">{type.description}</span>
            </button>
          ))}
        </div>
      </div>

      {kind === "VIDEO" && (
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          <LessonVideoPlayer url={previewUrl} title={title} />
        </div>
      )}

      {(kind === "ILT" || kind === "VILT") && (
        <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm">
          Schedule live sessions for this lesson from the <strong>Sessions</strong> tab in Course Studio.
          {kind === "ILT" ? " Learners register and attend in person." : " Add a meeting URL for virtual attendance."}
        </div>
      )}

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="studioTitle">Title</Label>
          <Input
            id="studioTitle"
            value={title}
            disabled={!canWrite}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="studioDescription">Short description</Label>
          <Input
            id="studioDescription"
            value={description}
            disabled={!canWrite}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={required}
            disabled={!canWrite}
            onCheckedChange={(checked) => setRequired(checked === true)}
          />
          Required for course completion
        </label>
        <div className="space-y-2">
          <Label>Prerequisite lesson</Label>
          <Select
            value={prerequisiteLessonId || "__none__"}
            onValueChange={(value) => setPrerequisiteLessonId(value === "__none__" ? "" : value)}
            disabled={!canWrite}
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {courseLessons
                .filter((item) => item.id !== lesson.id)
                .map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Learners must complete this lesson before accessing this one.
          </p>
        </div>
        {kind === "VIDEO" && (
          <LessonFileField
            kind="video"
            label="Video"
            hint="Upload MP4, WebM, MOV, or M4V up to 80 MB, or paste a YouTube, Vimeo, or https link."
            value={videoUrl}
            disabled={!canWrite}
            urlPlaceholder="YouTube, Vimeo, or https://…/video.mp4"
            onUrlChange={setVideoUrl}
            onUpload={async (file) => {
              const result = await uploadAsset.mutateAsync({
                lessonId: lesson.id,
                courseId,
                kind: "video",
                file,
              });
              setVideoUrl(result.path);
              setPreviewUrl(result.path);
              toast.success("Video uploaded");
            }}
            onClear={() => {
              setVideoUrl("");
              setPreviewUrl("");
            }}
          />
        )}
        {(kind === "DOCUMENT" || kind === "QUIZ") && (
          <LessonFileField
            kind="document"
            label={kind === "DOCUMENT" ? "Document" : "Optional quiz file or link"}
            hint="Upload a PDF or Office file up to 25 MB, or paste an https link."
            value={resourceUrl}
            disabled={!canWrite}
            urlPlaceholder="https://…/file.pdf"
            onUrlChange={setResourceUrl}
            onUpload={async (file) => {
              const result = await uploadAsset.mutateAsync({
                lessonId: lesson.id,
                courseId,
                kind: "document",
                file,
              });
              setResourceUrl(result.path);
              toast.success("File uploaded");
            }}
            onClear={() => setResourceUrl("")}
          />
        )}
        {kind === "QUIZ" && (
          <p className="text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
            {lesson.quizAssessmentId
              ? "Module quiz assessment is linked. Learners complete this lesson by passing that quiz."
              : "Required before publish: open the Assessments tab and create a Module quiz linked to this lesson."}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="studioDuration">Estimated time (minutes)</Label>
          <Input
            id="studioDuration"
            type="number"
            min={1}
            value={durationMinutes}
            disabled={!canWrite}
            onChange={(e) => setDurationMinutes(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="studioBody">
            {kind === "READING"
              ? "Article"
              : kind === "QUIZ"
                ? "Questions or instructions"
                : kind === "DISCUSSION"
                  ? "Discussion prompt"
                  : kind === "ILT" || kind === "VILT"
                    ? "Session overview"
                    : "Notes"}
          </Label>
          <Textarea
            id="studioBody"
            value={content}
            disabled={!canWrite}
            rows={kind === "VIDEO" ? 5 : 12}
            placeholder={
              kind === "READING"
                ? "Write the reading for this lesson."
                : kind === "QUIZ"
                  ? "Add the knowledge-check prompt or questions."
                  : kind === "DISCUSSION"
                    ? "What should learners discuss or reflect on?"
                    : "Optional supporting notes."
            }
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
        {kind === "DOCUMENT" && resourceUrl && (
          <a
            href={resolveAssetUrl(resourceUrl)}
            target="_blank"
            rel="noreferrer"
            className="text-indigo inline-flex items-center gap-1 text-sm"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open document
          </a>
        )}
      </div>

      {canWrite && (
        <Button type="submit" disabled={updateLesson.isPending || !title.trim()}>
          {updateLesson.isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Saving…
            </>
          ) : (
            "Save lesson"
          )}
        </Button>
      )}
    </form>
  );
}
