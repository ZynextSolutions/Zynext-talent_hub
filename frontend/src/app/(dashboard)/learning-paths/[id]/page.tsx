"use client";

import { use } from "react";
import { PathLearnerView } from "@/components/learning-paths/path-learner-view";
import { PathManageView } from "@/components/learning-paths/path-manage-view";
import { useAuth } from "@/hooks/useAuth";

export default function LearningPathDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: pathId } = use(params);
  const { hasPermission } = useAuth();

  if (hasPermission("learning-path:write")) {
    return <PathManageView pathId={pathId} />;
  }

  return <PathLearnerView pathId={pathId} />;
}
