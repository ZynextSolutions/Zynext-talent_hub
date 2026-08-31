"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useCreateCourse } from "@/hooks/useCourses";
import { ApiClientError } from "@/lib/api-client";
import { toast } from "sonner";

export function CreateCourseDialog() {
  const { hasPermission } = useAuth();
  const router = useRouter();
  const createCourse = useCreateCourse();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  if (!hasPermission("course:write")) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const course = await createCourse.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
      });
      setOpen(false);
      setTitle("");
      setDescription("");
      router.push(`/courses/${course.id}`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create course");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New course
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create course</DialogTitle>
            <DialogDescription>
              Add a draft course. You can add lessons before publishing.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="courseTitle">Title</Label>
              <Input
                id="courseTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Security awareness 101"
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="courseDescription">Description</Label>
              <Input
                id="courseDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional summary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createCourse.isPending || !title.trim()}>
              {createCourse.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Creating…
                </>
              ) : (
                "Create course"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
