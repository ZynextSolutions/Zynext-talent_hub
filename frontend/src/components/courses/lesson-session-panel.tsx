"use client";

import { useMemo, useState } from "react";
import { Calendar, ExternalLink, Loader2, MapPin, Users } from "lucide-react";
import { useCourseSessions, useRegisterSession } from "@/hooks/useSessions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Lesson } from "@/types";
import { formatDate } from "@/lib/utils";

interface LessonSessionPanelProps {
  courseId: string;
  lesson: Lesson;
  lessonCompleted?: boolean;
}

function formatSessionRange(startsAt: string, endsAt: string, timezone: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime())) return startsAt;
  const datePart = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = `${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  return `${datePart} · ${timePart} (${timezone})`;
}

export function LessonSessionPanel({ courseId, lesson, lessonCompleted }: LessonSessionPanelProps) {
  const { data: sessions, isLoading } = useCourseSessions(courseId, lesson.id);
  const register = useRegisterSession(courseId);
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set());

  const upcoming = useMemo(() => {
    const now = Date.now();
    return (sessions ?? [])
      .filter((s) => new Date(s.endsAt).getTime() >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [sessions]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sessions…
        </CardContent>
      </Card>
    );
  }

  if (!upcoming.length) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-6 text-sm">
          No upcoming sessions scheduled for this lesson yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {lessonCompleted ? (
        <Badge variant="default" className="mb-1">
          Attendance recorded — lesson complete
        </Badge>
      ) : null}
      {upcoming.map((session) => {
        const isRegistered = registeredIds.has(session.id);
        const full =
          session.capacity != null && session.registrationCount >= session.capacity && !isRegistered;

        return (
          <Card key={session.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{session.title}</p>
                  <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatSessionRange(session.startsAt, session.endsAt, session.timezone)}
                  </p>
                </div>
                <Badge variant={session.deliveryMode === "VILT" ? "secondary" : "outline"}>
                  {session.deliveryMode === "VILT" ? "Virtual" : "In person"}
                </Badge>
              </div>

              {session.description ? (
                <p className="text-muted-foreground text-sm">{session.description}</p>
              ) : null}

              {session.deliveryMode === "ILT" && session.location ? (
                <p className="flex items-center gap-1.5 text-sm">
                  <MapPin className="text-muted-foreground h-3.5 w-3.5" />
                  {session.location}
                </p>
              ) : null}

              {session.deliveryMode === "VILT" && session.meetingUrl ? (
                <a
                  href={session.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo inline-flex items-center gap-1.5 text-sm font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Join virtual session
                </a>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Users className="h-3.5 w-3.5" />
                  {session.registrationCount}
                  {session.capacity != null ? ` / ${session.capacity}` : ""} registered
                </p>
                {!lessonCompleted ? (
                  isRegistered ? (
                    <Badge variant="secondary">Registered</Badge>
                  ) : (
                    <Button
                      size="sm"
                      disabled={full || register.isPending}
                      onClick={() =>
                        register.mutate(session.id, {
                          onSuccess: () =>
                            setRegisteredIds((prev) => new Set(prev).add(session.id)),
                        })
                      }
                    >
                      {register.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {full ? "Session full" : "Register"}
                    </Button>
                  )
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
