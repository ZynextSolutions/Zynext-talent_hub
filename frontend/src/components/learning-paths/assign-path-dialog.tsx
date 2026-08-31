"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Users } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssignLearningPath, usePathAssignments } from "@/hooks/useLearningPaths";
import { useOrgTree } from "@/hooks/useOrgTree";
import {
  assignTargetKey,
  flattenAssignTargets,
  parseAssignTargetKey,
  type AssignTargetType,
} from "@/lib/org-targets";
import { ApiClientError } from "@/lib/api-client";
import { toast } from "sonner";

interface AssignPathDialogProps {
  pathId: string;
  trigger?: React.ReactNode;
}

export function AssignPathDialog({ pathId, trigger }: AssignPathDialogProps) {
  const assignPath = useAssignLearningPath(pathId);
  const { data: assignments } = usePathAssignments(pathId);
  const { data: orgTree, isLoading } = useOrgTree(true);
  const [open, setOpen] = useState(false);
  const [targetKey, setTargetKey] = useState("");

  const targets = useMemo(() => (orgTree ? flattenAssignTargets(orgTree) : []), [orgTree]);

  const assignedKeys = useMemo(
    () =>
      new Set(
        assignments?.map((assignment) =>
          assignTargetKey({
            type: assignment.targetType as AssignTargetType,
            id: assignment.targetId,
          }),
        ) ?? [],
      ),
    [assignments],
  );

  useEffect(() => {
    if (!open) return;
    setTargetKey("");
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseAssignTargetKey(targetKey);
    if (!parsed) {
      toast.error("Select who should receive this learning path");
      return;
    }
    if (assignedKeys.has(targetKey)) {
      toast.error("This target is already assigned");
      return;
    }
    const target = targets.find((item) => assignTargetKey(item) === targetKey);
    if (!target) {
      toast.error("Select a valid assignment target");
      return;
    }
    try {
      await assignPath.mutateAsync({
        targetType: target.type,
        targetId: target.id,
      });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to assign learning path");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Users className="mr-2 h-4 w-4" />
            Assign path
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Assign learning path</DialogTitle>
            <DialogDescription>
              Enroll active and invited users in this path. Existing path enrollments are kept.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={assignPath.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={assignPath.isPending || !targetKey || assignedKeys.has(targetKey)}
            >
              {assignPath.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Assigning…
                </>
              ) : (
                "Assign path"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
