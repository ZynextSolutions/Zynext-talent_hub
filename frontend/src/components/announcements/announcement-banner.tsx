"use client";

import { useMemo, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { useActiveAnnouncements } from "@/hooks/useAnnouncements";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "cor-lms-dismissed-announcements";

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
}

export function AnnouncementBannerStack({ className }: { className?: string }) {
  const { data: announcements } = useActiveAnnouncements();
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());

  const visible = useMemo(
    () => (announcements ?? []).filter((row) => row.publishedAt && !dismissed.has(row.id)),
    [announcements, dismissed],
  );

  if (!visible.length) return null;

  function dismiss(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    saveDismissed(next);
  }

  return (
    <div className={cn("space-y-2", className)}>
      {visible.map((item) => (
        <div
          key={item.id}
          className="relative rounded-xl border border-indigo/20 bg-indigo/10 px-4 py-3 pr-10 shadow-sm"
        >
          <div className="flex items-start gap-2">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-indigo" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{item.title}</p>
              {item.courseTitle ? (
                <p className="text-muted-foreground text-xs">{item.courseTitle}</p>
              ) : null}
              <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">{item.body}</p>
            </div>
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground absolute right-2 top-2 rounded p-1"
            aria-label="Dismiss announcement"
            onClick={() => dismiss(item.id)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
