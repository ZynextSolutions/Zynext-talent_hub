"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMediaUrl } from "@/hooks/useMediaUrl";
import { resolveVideoSource } from "@/lib/video-embed";

interface LessonVideoPlayerProps {
  url?: string | null;
  title?: string;
  poster?: string | null;
  initialPosition?: number;
  onPosition?: (seconds: number) => void;
}

export function LessonVideoPlayer({
  url,
  title,
  poster,
  initialPosition,
  onPosition,
}: LessonVideoPlayerProps) {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const authenticatedUploadUrl = useMediaUrl(url?.startsWith("/uploads/") ? url : null);

  const resolvedUrl = useMemo(() => {
    if (!url?.trim()) return null;
    if (url.startsWith("/uploads/")) return authenticatedUploadUrl || null;
    return url;
  }, [url, authenticatedUploadUrl]);

  const source = useMemo(
    () => (resolvedUrl ? resolveVideoSource(resolvedUrl, initialPosition) : null),
    [resolvedUrl, initialPosition],
  );

  if (authLoading && url?.startsWith("/uploads/")) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <Play className="h-12 w-12 animate-pulse opacity-40" />
        <p className="text-sm">Loading video…</p>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <Play className="h-12 w-12 opacity-40" />
        <p className="text-sm">
          {!isAuthenticated && url?.startsWith("/uploads/")
            ? "Sign in to preview uploaded video"
            : "No video for this lesson"}
        </p>
      </div>
    );
  }

  if (source.kind === "youtube" || source.kind === "vimeo") {
    return (
      <iframe
        key={`${source.embedUrl}-${initialPosition ?? 0}`}
        src={source.embedUrl}
        title={title || "Lesson video"}
        className="h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  return (
    <FileVideo
      key={source.src}
      src={source.src}
      poster={poster}
      initialPosition={initialPosition}
      onPosition={onPosition}
    />
  );
}

function FileVideo({
  src,
  poster,
  initialPosition,
  onPosition,
}: {
  src: string;
  poster?: string | null;
  initialPosition?: number;
  onPosition?: (seconds: number) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  const resolvedPoster = useMediaUrl(poster?.startsWith("/uploads/") ? poster : null);
  const posterSrc =
    poster?.startsWith("/uploads/") ? resolvedPoster || undefined : poster ?? undefined;

  useEffect(() => {
    const el = ref.current;
    if (!el || !initialPosition || initialPosition <= 0) return;
    const seek = () => {
      if (Number.isFinite(el.duration) && initialPosition < el.duration) {
        el.currentTime = initialPosition;
      }
    };
    if (el.readyState >= 1) seek();
    else el.addEventListener("loadedmetadata", seek, { once: true });
    return () => el.removeEventListener("loadedmetadata", seek);
  }, [src, initialPosition]);

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={ref}
        src={src}
        playsInline
        preload="auto"
        controls
        poster={posterSrc}
        onError={() => setError(true)}
        onLoadedData={() => setError(false)}
        onTimeUpdate={() => {
          if (ref.current) onPosition?.(Math.floor(ref.current.currentTime));
        }}
        onPause={() => {
          if (ref.current) onPosition?.(Math.floor(ref.current.currentTime));
        }}
        className="h-full w-full bg-black object-contain"
      />
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center text-sm text-white">
          <p>This video could not be played.</p>
          <p className="text-white/70 text-xs">Try MP4 (H.264) or a YouTube / Vimeo link.</p>
        </div>
      ) : null}
    </div>
  );
}
