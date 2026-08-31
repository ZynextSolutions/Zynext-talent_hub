"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCreateDepartment,
  useCreateDivision,
  useCreateTeam,
  useUpdateDepartment,
  useUpdateDivision,
  useUpdateTeam,
} from "@/hooks/useOrgNodes";
import { ApiClientError } from "@/lib/api-client";
import type { NodeType } from "@/types";
import { toast } from "sonner";

export type OrgNodeDialogMode = "create" | "rename";

export interface OrgNodeDialogState {
  open: boolean;
  mode: OrgNodeDialogMode;
  nodeType: NodeType;
  nodeId?: string;
  parentId?: string | null;
  initialName?: string;
}

interface OrgNodeDialogProps {
  state: OrgNodeDialogState;
  onOpenChange: (open: boolean) => void;
}

const labels: Record<NodeType, string> = {
  ORGANIZATION: "Organization",
  DIVISION: "Division",
  DEPARTMENT: "Department",
  TEAM: "Team",
  USER: "User",
};

export function OrgNodeDialog({ state, onOpenChange }: OrgNodeDialogProps) {
  const [name, setName] = useState("");
  const createDivision = useCreateDivision();
  const createDepartment = useCreateDepartment();
  const createTeam = useCreateTeam();
  const updateDivision = useUpdateDivision();
  const updateDepartment = useUpdateDepartment();
  const updateTeam = useUpdateTeam();

  useEffect(() => {
    if (state.open) setName(state.initialName ?? "");
  }, [state.open, state.initialName]);

  const isPending =
    createDivision.isPending ||
    createDepartment.isPending ||
    createTeam.isPending ||
    updateDivision.isPending ||
    updateDepartment.isPending ||
    updateTeam.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      if (state.mode === "rename" && state.nodeId) {
        if (state.nodeType === "DIVISION") {
          await updateDivision.mutateAsync({ id: state.nodeId, name: trimmed });
        } else if (state.nodeType === "DEPARTMENT") {
          await updateDepartment.mutateAsync({ id: state.nodeId, name: trimmed });
        } else if (state.nodeType === "TEAM") {
          await updateTeam.mutateAsync({ id: state.nodeId, name: trimmed });
        }
      } else if (state.mode === "create") {
        if (state.nodeType === "DIVISION") {
          await createDivision.mutateAsync({ name: trimmed });
        } else if (state.nodeType === "DEPARTMENT") {
          await createDepartment.mutateAsync({
            name: trimmed,
            divisionId: state.parentId ?? null,
          });
        } else if (state.nodeType === "TEAM" && state.parentId) {
          await createTeam.mutateAsync({ name: trimmed, departmentId: state.parentId });
        }
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Operation failed");
    }
  }

  const title =
    state.mode === "rename"
      ? `Rename ${labels[state.nodeType].toLowerCase()}`
      : `Add ${labels[state.nodeType].toLowerCase()}`;

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="org-node-name">Name</Label>
              <Input
                id="org-node-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving…
                </>
              ) : state.mode === "rename" ? (
                "Save"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
