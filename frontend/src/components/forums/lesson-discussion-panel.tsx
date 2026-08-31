"use client";

import { useMemo, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { ForumComposer } from "@/components/forums/forum-composer";
import { ForumThreadView } from "@/components/forums/forum-thread-view";
import {
  useCourseForumThreads,
  useCreateForumThread,
  useForumThread,
} from "@/hooks/useForums";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Lesson } from "@/types";
import { formatDate } from "@/lib/utils";

interface LessonDiscussionPanelProps {
  courseId: string;
  lesson: Lesson;
}

export function LessonDiscussionPanel({ courseId, lesson }: LessonDiscussionPanelProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data, isLoading } = useCourseForumThreads(courseId);
  const lessonThreads = useMemo(
    () => (data?.items ?? []).filter((t) => t.lessonId === lesson.id),
    [data?.items, lesson.id],
  );
  const { data: threadDetail, isLoading: threadLoading } = useForumThread(selectedThreadId ?? "");
  const createThread = useCreateForumThread();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    const created = await createThread.mutateAsync({
      scope: "COURSE",
      courseId,
      lessonId: lesson.id,
      title: title.trim(),
      body: body.trim(),
    });
    setTitle("");
    setBody("");
    setShowComposer(false);
    setSelectedThreadId(created.id);
  }

  if (selectedThreadId) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedThreadId(null)}>
          ← Back to discussions
        </Button>
        <ForumThreadView
          thread={threadDetail?.thread}
          posts={threadDetail?.posts}
          isLoading={threadLoading}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="text-indigo h-4 w-4" />
            <p className="font-medium">Discussion</p>
          </div>
          {!showComposer ? (
            <Button size="sm" variant="outline" onClick={() => setShowComposer(true)}>
              Start discussion
            </Button>
          ) : null}
        </div>

        {showComposer ? (
          <form onSubmit={handleCreate} className="space-y-3 rounded-lg border p-4">
            <ForumComposer
              showTitle
              title={title}
              onTitleChange={setTitle}
              value={body}
              onChange={setBody}
              disabled={createThread.isPending}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={createThread.isPending || !title.trim() || !body.trim()}>
                {createThread.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Post
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowComposer(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {isLoading ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : !lessonThreads.length ? (
          <p className="text-muted-foreground text-sm">
            No threads for this lesson yet. Start the conversation above.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {lessonThreads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  className="hover:bg-accent/50 flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{thread.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {thread.author.firstName} {thread.author.lastName} · {formatDate(thread.createdAt)}
                    </p>
                  </div>
                  <Badge variant="secondary">{thread.postCount}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
