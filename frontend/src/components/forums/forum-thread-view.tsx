"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ForumComposer } from "@/components/forums/forum-composer";
import { useCreateForumPost } from "@/hooks/useForums";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ForumPost, ForumThread } from "@/types";
import { formatDate } from "@/lib/utils";

interface ForumThreadViewProps {
  thread: ForumThread | undefined;
  posts: ForumPost[] | undefined;
  isLoading?: boolean;
  canReply?: boolean;
}

export function ForumThreadView({ thread, posts, isLoading, canReply = true }: ForumThreadViewProps) {
  const createPost = useCreateForumPost();
  const [reply, setReply] = useState("");

  if (isLoading || !thread) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    );
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!thread || !reply.trim() || thread.locked) return;
    await createPost.mutateAsync({ threadId: thread.id, body: reply.trim() });
    setReply("");
  }

  return (
    <div className="space-y-6">
      <article className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{thread.title}</h1>
          {thread.pinned ? <Badge variant="secondary">Pinned</Badge> : null}
          {thread.locked ? <Badge variant="outline">Locked</Badge> : null}
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          {thread.author.firstName} {thread.author.lastName} · {formatDate(thread.createdAt)}
        </p>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{thread.body}</p>
      </article>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Replies ({posts?.length ?? 0})</h2>
        {!posts?.length ? (
          <p className="text-muted-foreground text-sm">No replies yet.</p>
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => (
              <li key={post.id} className="rounded-lg border bg-card/50 px-4 py-3">
                <p className="text-muted-foreground text-xs">
                  {post.author.firstName} {post.author.lastName} · {formatDate(post.createdAt)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{post.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canReply && !thread.locked ? (
        <form onSubmit={handleReply} className="space-y-3">
          <ForumComposer
            value={reply}
            onChange={setReply}
            placeholder="Write a reply…"
            rows={4}
            disabled={createPost.isPending}
          />
          <button
            type="submit"
            disabled={!reply.trim() || createPost.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {createPost.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Post reply
          </button>
        </form>
      ) : thread.locked ? (
        <p className="text-muted-foreground text-sm">This thread is locked.</p>
      ) : null}
    </div>
  );
}
