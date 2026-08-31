"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api, resolveApiUrl } from "@/lib/api-client";

interface ScormPlayerProps {
  enrollmentId?: string;
  courseId?: string;
  preview?: boolean;
}

export function ScormPlayer({ enrollmentId, courseId, preview }: ScormPlayerProps) {
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: preview
      ? ["scorm", "preview", courseId]
      : ["scorm", "launch", enrollmentId],
    queryFn: () =>
      preview
        ? api.get<{ playerUrl: string; scormVersion: string }>(
            `/courses/${courseId}/scorm/preview/launch`,
          )
        : api.get<{ playerUrl: string; scormVersion: string }>(
            `/learn/scorm/${enrollmentId}/launch`,
          ),
    enabled: isAuthenticated && (preview ? !!courseId : !!enrollmentId),
  });

  const playerSrc = useMemo(() => {
    if (!data?.playerUrl || !isAuthenticated) return "";
    return resolveApiUrl(data.playerUrl);
  }, [data?.playerUrl, isAuthenticated]);

  if (authLoading || isLoading) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-border bg-muted/30">
        <Loader2 className="text-indigo h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !playerSrc) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {!isAuthenticated
          ? "Sign in to load SCORM content."
          : "Unable to load SCORM content."}
      </div>
    );
  }

  return (
    <div className="aspect-[4/3] overflow-hidden rounded-xl border border-border bg-black shadow-luxury-lg md:aspect-video">
      {preview ? (
        <p className="bg-muted/40 text-muted-foreground border-b border-border px-3 py-1.5 text-xs">
          Author preview — progress is not saved until you enroll as a learner.
        </p>
      ) : null}
      <iframe
        title="SCORM content"
        src={playerSrc}
        className={preview ? "h-[calc(100%-2rem)] w-full border-0" : "h-full w-full border-0"}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
        allow="fullscreen"
      />
    </div>
  );
}
