"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, Users } from "lucide-react";
import { AssignTargetPicker } from "@/components/courses/assign-target-picker";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssignCourse, useCourseAssignments } from "@/hooks/useCourses";
import { useOrgTree } from "@/hooks/useOrgTree";
import {
  assignTargetKey,
  flattenAssignTargets,
  parseAssignTargetKey,
  type AssignTargetType,
} from "@/lib/org-targets";
import { ApiClientError } from "@/lib/api-client";
import { toast } from "sonner";

interface AssignCourseDialogProps {
  courseId: string;
  trigger?: React.ReactNode;
}

export function AssignCourseDialog({ courseId, trigger }: AssignCourseDialogProps) {
  const assignCourse = useAssignCourse(courseId);
  const { data: assignments } = useCourseAssignments(courseId);
  const { data: orgTree, isLoading } = useOrgTree(true);
  const [open, setOpen] = useState(false);
  const [targetKey, setTargetKey] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recertifyDays, setRecertifyDays] = useState("");
  const [reminderDays, setReminderDays] = useState("7");

  const targets = useMemo(() => (orgTree ? flattenAssignTargets(orgTree) : []), [orgTree]);

  const assignedKeys = useMemo(
    () =>
      new Set(
        assignments?.map((a) =>
          assignTargetKey({ type: a.targetType as AssignTargetType, id: a.targetId }),
        ) ?? [],
      ),
    [assignments],
  );

  useEffect(() => {
    if (!open) return;
    setTargetKey("");
    setDueDate("");
    setRecertifyDays("");
    setReminderDays("7");
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseAssignTargetKey(targetKey);
    if (!parsed) {
      toast.error("Select who should receive this course");
      return;
    }
    if (assignedKeys.has(targetKey)) {
      toast.error("This target is already assigned");
      return;
    }
    const target = targets.find((t) => assignTargetKey(t) === targetKey);
    if (!target) {
      toast.error("Select a valid assignment target");
      return;
    }
    try {
      await assignCourse.mutateAsync({
        targetType: target.type,
        targetId: target.id,
        dueAt: dueDate ? new Date(`${dueDate}T23:59:59.999Z`).toISOString() : null,
        recertifyEveryDays: recertifyDays ? Number(recertifyDays) : null,
        reminderDaysBefore: reminderDays ? Number(reminderDays) : null,
      });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to assign course");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Users className="mr-2 h-4 w-4" />
            Assign
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Assign course</DialogTitle>
            <DialogDescription>
              Choose an org unit, team, or individual. Active and invited users are enrolled;
              existing progress is kept.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Assign to</Label>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-56 w-full" />
                </div>
              ) : targets.length ? (
                <AssignTargetPicker
                  targets={targets}
                  value={targetKey}
                  onChange={setTargetKey}
                  excludeKeys={assignedKeys}
                />
              ) : (
                <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                  No org structure found. Add divisions, teams, or users in Organization first.
                </p>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="text-muted-foreground h-4 w-4" />
                <p className="text-sm font-medium">Schedule & compliance</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="due-date">Due date</Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recertify">Recertify every (days)</Label>
                  <Input
                    id="recertify"
                    type="number"
                    min={1}
                    placeholder="Optional"
                    value={recertifyDays}
                    onChange={(e) => setRecertifyDays(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reminder">Reminder before due (days)</Label>
                  <Input
                    id="reminder"
                    type="number"
                    min={0}
                    placeholder="7"
                    value={reminderDays}
                    onChange={(e) => setReminderDays(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={assignCourse.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={assignCourse.isPending || !targetKey || assignedKeys.has(targetKey)}
            >
              {assignCourse.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Assigning…
                </>
              ) : (
                "Assign course"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
