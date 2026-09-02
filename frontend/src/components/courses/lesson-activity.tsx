"use client";

import { ExternalLink } from "lucide-react";
import { CourseQuizPanel } from "@/components/courses/course-quiz-panel";
import { LessonVideoPlayer } from "@/components/courses/lesson-video-player";
import { LessonSessionPanel } from "@/components/courses/lesson-session-panel";
import { ScormPlayer } from "@/components/courses/scorm-player";
import { LessonDiscussionPanel } from "@/components/forums/lesson-discussion-panel";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { resolveAssetUrl } from "@/lib/certificate-template";
import { lessonKind, lessonTypeLabel } from "@/lib/course-outline";
import type { Lesson } from "@/types";

interface LessonActivityProps {
  lesson: Lesson;
  courseId: string;
  enrollmentId?: string;
  lessonCompleted?: boolean;
  fallbackVideoUrl?: string | null;
  poster?: string | null;
  initialPosition?: number;
  onPosition?: (seconds: number) => void;
}

export function LessonActivity({
  lesson,
  courseId,
  enrollmentId,
  lessonCompleted,
  fallbackVideoUrl,
  poster,
  initialPosition,
  onPosition,
}: LessonActivityProps) {
  const kind = lessonKind(lesson);
  const { hasPermission } = useAuth();
  const canPreviewScorm = !enrollmentId && hasPermission("course:write");

  return (
    <div className="space-y-6">
      {kind === "SCORM" && enrollmentId ? <ScormPlayer enrollmentId={enrollmentId} /> : null}
      {kind === "SCORM" && canPreviewScorm ? (
        <ScormPlayer courseId={courseId} preview />
      ) : null}
      {kind === "VIDEO" && (
        <div className="aspect-video overflow-hidden rounded-xl bg-black shadow-luxury-lg">
          <LessonVideoPlayer
            url={lesson.videoUrl || fallbackVideoUrl}
            title={lesson.title}
            poster={poster}
            initialPosition={initialPosition}
            onPosition={onPosition}
          />
        </div>
      )}

      <div>
        <p className="text-muted-foreground text-xs uppercase tracking-wider">{lessonTypeLabel(kind)}</p>
        <h2 className="mt-1 text-xl font-semibold">{lesson.title}</h2>
        {lesson.description && (
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{lesson.description}</p>
        )}
      </div>

      {kind === "DOCUMENT" && lesson.resourceUrl && (
        <Card>
          <CardContent className="p-6">
            <a
              href={resolveAssetUrl(lesson.resourceUrl)}
              target="_blank"
              rel="noreferrer"
              className="text-indigo inline-flex items-center gap-2 text-sm font-medium"
            >
              <ExternalLink className="h-4 w-4" />
              Open document
            </a>
          </CardContent>
        </Card>
      )}

      {kind === "QUIZ" && enrollmentId && lesson.quizAssessmentId ? (
        <CourseQuizPanel
          courseId={courseId}
          enrollmentId={enrollmentId}
          lessonsComplete
          kind="MODULE_QUIZ"
          assessmentId={lesson.quizAssessmentId}
        />
      ) : null}

      {kind === "QUIZ" && !lesson.quizAssessmentId ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="space-y-3 p-6">
            <p className="font-medium">Quiz not configured</p>
            <p className="text-muted-foreground text-sm">
              This quiz lesson has no linked assessment, so it cannot be completed. Ask an admin to
              open Course Studio → Assessments and add a Module quiz for this lesson.
            </p>
            {lesson.resourceUrl ? (
              <a
                href={resolveAssetUrl(lesson.resourceUrl)}
                target="_blank"
                rel="noreferrer"
                className="text-indigo inline-flex items-center gap-2 text-sm font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                Open practice quiz file
              </a>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {(kind === "ILT" || kind === "VILT") && enrollmentId ? (
        <LessonSessionPanel courseId={courseId} lesson={lesson} lessonCompleted={lessonCompleted} />
      ) : null}

      {kind === "DISCUSSION" && enrollmentId ? (
        <LessonDiscussionPanel courseId={courseId} lesson={lesson} />
      ) : null}

      {lesson.content && kind !== "DISCUSSION" && (
        <Card>
          <CardContent className="prose prose-invert max-w-none p-6 text-sm leading-relaxed whitespace-pre-wrap">
            {lesson.content}
          </CardContent>
        </Card>
      )}

      {kind === "DISCUSSION" && lesson.content ? (
        <Card>
          <CardContent className="prose prose-invert max-w-none p-6 text-sm leading-relaxed whitespace-pre-wrap">
            <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">Prompt</p>
            {lesson.content}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
