"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
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
import { usePatchAssignment, type CourseAssignment } from "@/hooks/useCourses";
import { ApiClientError } from "@/lib/api-client";
import { toast } from "sonner";

interface EditAssignmentDialogProps {
  courseId: string;
  assignment: CourseAssignment;
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function EditAssignmentDialog({ courseId, assignment }: EditAssignmentDialogProps) {
  const patchAssignment = usePatchAssignment(courseId);
  const [open, setOpen] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [recertifyDays, setRecertifyDays] = useState("");
  const [reminderDays, setReminderDays] = useState("");

  useEffect(() => {
    if (!open) return;
    setDueDate(toDateInputValue(assignment.dueAt));
    setRecertifyDays(
      assignment.recertifyEveryDays != null ? String(assignment.recertifyEveryDays) : "",
    );
    setReminderDays(
      assignment.reminderDaysBefore != null ? String(assignment.reminderDaysBefore) : "",
    );
  }, [open, assignment]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await patchAssignment.mutateAsync({
        assignmentId: assignment.id,
        dueAt: dueDate ? new Date(`${dueDate}T23:59:59.999Z`).toISOString() : null,
        recertifyEveryDays: recertifyDays ? Number(recertifyDays) : null,
        reminderDaysBefore: reminderDays ? Number(reminderDays) : null,
      });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to update assignment");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit assignment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-due-date">Due date</Label>
              <Input
                id="edit-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">Clear the date to remove the due date.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-recertify">Recertify every N days</Label>
              <Input
                id="edit-recertify"
                type="number"
                min={1}
                placeholder="None"
                value={recertifyDays}
                onChange={(e) => setRecertifyDays(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-reminder">Reminder days before due</Label>
              <Input
                id="edit-reminder"
                type="number"
                min={0}
                placeholder="Default 7"
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={patchAssignment.isPending}>
              {patchAssignment.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
