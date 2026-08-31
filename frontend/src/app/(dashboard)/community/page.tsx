"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ForumComposer } from "@/components/forums/forum-composer";
import { ForumThreadList } from "@/components/forums/forum-thread-list";
import { useCreateForumThread, useOrgForumThreads } from "@/hooks/useForums";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CommunityPage() {
  const [page] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { data, isLoading } = useOrgForumThreads(page);
  const createThread = useCreateForumThread();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    await createThread.mutateAsync({
      scope: "ORGANIZATION",
      title: title.trim(),
      body: body.trim(),
    });
    setTitle("");
    setBody("");
    setDialogOpen(false);
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Community"
        description="Organization-wide discussions and announcements from peers."
      />

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 pb-10">
        <ForumThreadList
          threads={data?.items}
          isLoading={isLoading}
          threadHref={(id) => `/community/${id}`}
          onCreateClick={() => setDialogOpen(true)}
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Start a discussion</DialogTitle>
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
