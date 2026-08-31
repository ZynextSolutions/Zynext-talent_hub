"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Trash2, Users } from "lucide-react";
import {
  useCourseSessions,
  useCreateSession,
  useDeleteSession,
  useMarkSessionAttendance,
  useSessionRegistrations,
} from "@/hooks/useSessions";
import { useCourse } from "@/hooks/useCourses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { lessonKind } from "@/lib/course-outline";
import { formatDate } from "@/lib/utils";

interface CourseSessionsPanelProps {
  courseId: string;
  canWrite: boolean;
}

export function CourseSessionsPanel({ courseId, canWrite }: CourseSessionsPanelProps) {
  const { data: course } = useCourse(courseId);
  const { data: sessions, isLoading } = useCourseSessions(courseId);
  const createSession = useCreateSession(courseId);
  const deleteSession = useDeleteSession(courseId);
  const markAttendance = useMarkSessionAttendance(courseId);

  const iltLessons = useMemo(
    () =>
      (course?.lessons ?? []).filter((l) => {
        const kind = lessonKind(l);
        return kind === "ILT" || kind === "VILT";
      }),
    [course?.lessons],
  );

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const { data: registrations, isLoading: regsLoading } = useSessionRegistrations(
    courseId,
    selectedSessionId ?? "",
    !!selectedSessionId && canWrite,
  );

  const [lessonId, setLessonId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [capacity, setCapacity] = useState("");

  const selectedLesson = iltLessons.find((l) => l.id === lessonId);
  const deliveryMode = selectedLesson ? lessonKind(selectedLesson) : "ILT";

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonId || !title.trim() || !startsAt || !endsAt) return;
    await createSession.mutateAsync({
      lessonId,
      title: title.trim(),
      description: description.trim() || undefined,
      deliveryMode: deliveryMode === "VILT" ? "VILT" : "ILT",
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      location: deliveryMode === "ILT" ? location.trim() || null : null,
      meetingUrl: deliveryMode === "VILT" ? meetingUrl.trim() || null : null,
      capacity: capacity ? Number(capacity) : null,
    });
    setTitle("");
    setDescription("");
    setStartsAt("");
    setEndsAt("");
    setLocation("");
    setMeetingUrl("");
    setCapacity("");
  }

  if (isLoading) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      {canWrite ? (
        <form onSubmit={handleCreate} className="space-y-4 rounded-xl border p-5">
          <h3 className="font-semibold">Schedule session</h3>
          {iltLessons.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Add an ILT or VILT lesson to the course outline first.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Linked lesson</Label>
                  <Select value={lessonId} onValueChange={setLessonId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select lesson" />
                    </SelectTrigger>
                    <SelectContent>
                      {iltLessons.map((lesson) => (
                        <SelectItem key={lesson.id} value={lesson.id}>
                          {lesson.title} ({lessonKind(lesson)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session-title">Title</Label>
                  <Input
                    id="session-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="starts-at">Starts</Label>
                  <Input
                    id="starts-at"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ends-at">Ends</Label>
                  <Input
                    id="ends-at"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    required
                  />
                </div>
                {deliveryMode === "ILT" ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Room or address"
                    />
                  </div>
                ) : (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="meeting-url">Meeting URL</Label>
                    <Input
                      id="meeting-url"
                      value={meetingUrl}
                      onChange={(e) => setMeetingUrl(e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacity (optional)</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min={1}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="session-desc">Description</Label>
                <Textarea
                  id="session-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <Button type="submit" disabled={createSession.isPending || !lessonId}>
                {createSession.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create session
              </Button>
            </>
          )}
        </form>
      ) : null}

      <div className="space-y-3">
        <h3 className="font-semibold">Scheduled sessions</h3>
        {!sessions?.length ? (
          <p className="text-muted-foreground text-sm">No sessions scheduled.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {sessions.map((session) => (
              <li key={session.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{session.title}</p>
                    <Badge variant="outline">{session.deliveryMode}</Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {formatDate(session.startsAt)} · {session.registrationCount} registered
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canWrite ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setSelectedSessionId((prev) => (prev === session.id ? null : session.id))
                        }
                      >
                        <Users className="mr-1 h-4 w-4" />
                        Roster
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("Delete this session?")) deleteSession.mutate(session.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedSessionId && canWrite ? (
        <div className="rounded-xl border p-5">
          <h4 className="mb-3 font-medium">Attendance roster</h4>
          {regsLoading ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : !registrations?.length ? (
            <p className="text-muted-foreground text-sm">No registrations yet.</p>
          ) : (
            <ul className="space-y-2">
              {registrations.map((reg) => (
                <li
                  key={reg.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {reg.user
                        ? `${reg.user.firstName} ${reg.user.lastName}`
                        : reg.userId.slice(0, 8)}
                    </p>
                    <p className="text-muted-foreground text-xs">{reg.status}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={reg.status === "ATTENDED" ? "default" : "outline"}
                      disabled={markAttendance.isPending}
                      onClick={() =>
                        markAttendance.mutate({
                          sessionId: selectedSessionId,
                          userIds: [reg.userId],
                          status: "ATTENDED",
                        })
                      }
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Attended
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={markAttendance.isPending}
                      onClick={() =>
                        markAttendance.mutate({
                          sessionId: selectedSessionId,
                          userIds: [reg.userId],
                          status: "NO_SHOW",
                        })
                      }
                    >
                      No show
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
