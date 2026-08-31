"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ForumComposer } from "@/components/forums/forum-composer";
import { ForumThreadView } from "@/components/forums/forum-thread-view";
import { useCourseForumThreads, useCreateForumThread, useForumThread } from "@/hooks/useForums";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";

interface CourseForumPanelProps {
  courseId: string;
}

export function CourseForumPanel({ courseId }: CourseForumPanelProps) {
  const [page] = useState(1);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data, isLoading } = useCourseForumThreads(courseId, page);
  const { data: threadDetail, isLoading: threadLoading } = useForumThread(selectedThreadId ?? "");
  const createThread = useCreateForumThread();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    const created = await createThread.mutateAsync({
      scope: "COURSE",
      courseId,
      title: title.trim(),
      body: body.trim(),
    });
    setTitle("");
    setBody("");
    setDialogOpen(false);
    setSelectedThreadId(created.id);
  }

  if (selectedThreadId) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedThreadId(null)}>
          ← Back to forum
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
    <div className="space-y-4">
      <Button size="sm" onClick={() => setDialogOpen(true)}>
        Start discussion
      </Button>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          No course discussions yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border">
          {data.items.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => setSelectedThreadId(thread.id)}
                className="hover:bg-accent/50 flex w-full flex-col gap-1 px-4 py-3 text-left text-sm transition-colors sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{thread.title}</p>
                  <p className="text-muted-foreground mt-1 line-clamp-2">{thread.body}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {thread.author.firstName} {thread.author.lastName} · {formatDate(thread.createdAt)}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 self-start sm:self-center">
                  {thread.postCount} {thread.postCount === 1 ? "reply" : "replies"}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Start course discussion</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <ForumComposer
                showTitle
                title={title}
                onTitleChange={setTitle}
                value={body}
                onChange={setBody}
                disabled={createThread.isPending}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createThread.isPending || !title.trim() || !body.trim()}>
                {createThread.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Post
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
