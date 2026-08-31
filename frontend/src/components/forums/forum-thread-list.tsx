"use client";

import Link from "next/link";
import { Loader2, MessageSquare, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ForumThread } from "@/types";
import { cn, formatDate } from "@/lib/utils";

interface ForumThreadListProps {
  threads: ForumThread[] | undefined;
  isLoading?: boolean;
  emptyMessage?: string;
  threadHref: (threadId: string) => string;
  onCreateClick?: () => void;
  createLabel?: string;
}

export function ForumThreadList({
  threads,
  isLoading,
  emptyMessage = "No discussions yet.",
  threadHref,
  onCreateClick,
  createLabel = "Start discussion",
}: ForumThreadListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {onCreateClick ? (
        <Button onClick={onCreateClick} size="sm">
          <MessageSquare className="mr-2 h-4 w-4" />
          {createLabel}
        </Button>
      ) : null}

      {!threads?.length ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          {emptyMessage}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link
                href={threadHref(thread.id)}
                className={cn(
                  "hover:bg-accent/50 flex flex-col gap-1 px-4 py-3 transition-colors sm:flex-row sm:items-center sm:justify-between",
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {thread.pinned ? (
                      <Pin className="text-indigo h-3.5 w-3.5 shrink-0" aria-label="Pinned" />
                    ) : null}
                    <p className="truncate font-medium">{thread.title}</p>
                    {thread.locked ? <Badge variant="outline">Locked</Badge> : null}
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{thread.body}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {thread.author.firstName} {thread.author.lastName} · {formatDate(thread.createdAt)}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 self-start sm:self-center">
                  {thread.postCount} {thread.postCount === 1 ? "reply" : "replies"}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ForumThreadListLoading() {
  return <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />;
}
