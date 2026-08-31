"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { resolveApiOrigin } from "@/lib/api-client";

/** Resolves /uploads/ paths through the authenticated media API once auth is ready. */
export function useMediaUrl(raw?: string | null): string {
  const { isLoading, isAuthenticated } = useAuth();
  const [resolved, setResolved] = useState("");

  useEffect(() => {
    if (!raw?.trim()) {
      setResolved("");
      return;
    }
    const trimmed = raw.trim();
    if (!trimmed.startsWith("/uploads/")) {
      setResolved(trimmed);
      return;
    }
    if (isLoading || !isAuthenticated) {
      setResolved("");
      return;
    }
    const origin = resolveApiOrigin();
    setResolved(`${origin}/api/v1/media${trimmed}`);
  }, [raw, isLoading, isAuthenticated]);

  return resolved;
}
