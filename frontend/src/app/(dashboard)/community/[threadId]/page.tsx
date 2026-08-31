"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { ForumThreadView } from "@/components/forums/forum-thread-view";
import { useForumThread } from "@/hooks/useForums";
import { Button } from "@/components/ui/button";

export default function CommunityThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = use(params);
  const { data, isLoading } = useForumThread(threadId);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="border-b px-6 py-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/community">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to community
          </Link>
        </Button>
      </div>
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <ForumThreadView
          thread={data?.thread}
          posts={data?.posts}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
