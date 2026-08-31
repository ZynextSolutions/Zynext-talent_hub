"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
} from "@/hooks/useAnnouncements";
import { useCourses } from "@/hooks/useCourses";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

const ORG_WIDE = "__org__";

export default function AnnouncementsPage() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("org:write") || hasPermission("course:write");
  const [page] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [courseId, setCourseId] = useState(ORG_WIDE);
  const [publishNow, setPublishNow] = useState(true);

  const { data, isLoading } = useAnnouncements({ page });
  const { data: courses } = useCourses({ page: 1, pageSize: 100 });
  const createAnnouncement = useCreateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    await createAnnouncement.mutateAsync({
      title: title.trim(),
      body: body.trim(),
      courseId: courseId === ORG_WIDE ? null : courseId,
      publishedAt: publishNow ? new Date().toISOString() : null,
    });
    setTitle("");
    setBody("");
    setCourseId(ORG_WIDE);
    setDialogOpen(false);
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Announcements"
        description="Publish org-wide or course-specific announcements for learners."
        actions={
          canWrite ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New announcement
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <form onSubmit={handleCreate}>
                  <DialogHeader>
                    <DialogTitle>Create announcement</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="ann-title">Title</Label>
                      <Input
                        id="ann-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={200}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ann-body">Message</Label>
                      <Textarea
                        id="ann-body"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={5}
                        maxLength={8000}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Scope</Label>
                      <Select value={courseId} onValueChange={setCourseId}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ORG_WIDE}>Organization-wide</SelectItem>
                          {(courses?.items ?? []).map((course) => (
                            <SelectItem key={course.id} value={course.id}>
                              {course.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={publishNow}
                        onChange={(e) => setPublishNow(e.target.checked)}
                      />
                      Publish immediately (sends notifications)
                    </label>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createAnnouncement.isPending}>
                      {createAnnouncement.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Create
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-6 pb-10">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : !data?.items.length ? (
          <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">
            No announcements yet.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {data.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.title}</p>
                    {item.publishedAt ? (
                      <Badge variant="default">Published</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                    {item.courseTitle ? (
                      <Badge variant="outline">{item.courseTitle}</Badge>
                    ) : (
                      <Badge variant="outline">Org-wide</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{item.body}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {item.publishedAt ? `Published ${formatDate(item.publishedAt)}` : "Not published"}
                    {item.expiresAt ? ` · Expires ${formatDate(item.expiresAt)}` : ""}
                  </p>
                </div>
                {canWrite ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive shrink-0"
                    onClick={() => {
                      if (confirm("Delete this announcement?")) {
                        deleteAnnouncement.mutate(item.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
