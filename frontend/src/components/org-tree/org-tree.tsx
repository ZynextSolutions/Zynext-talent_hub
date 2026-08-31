"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TreeNode, type TreeNodeData } from "@/components/org-tree/tree-node";
import {
  OrgNodeDialog,
  type OrgNodeDialogState,
} from "@/components/org-tree/org-node-dialog";
import { useOrgTree } from "@/components/org-tree/use-org-tree";
import { useAuth } from "@/hooks/useAuth";
import {
  useDeleteDepartment,
  useDeleteDivision,
  useDeleteTeam,
} from "@/hooks/useOrgNodes";
import type { MoveNodeRequest, NodeType, OrgTree } from "@/types";

function buildTreeNodes(tree: OrgTree): TreeNodeData[] {
  const nodes: TreeNodeData[] = [];
  const orgId = tree.organization.id;

  nodes.push({
    id: orgId,
    name: tree.organization.name,
    type: "ORGANIZATION",
    parentType: "ROOT",
    parentId: null,
    depth: 0,
    childCount: tree.divisions.length + tree.unassignedDepartments.length,
    draggable: false,
  });

  for (const division of tree.divisions) {
    nodes.push({
      id: division.id,
      name: division.name,
      type: "DIVISION",
      parentType: "ORGANIZATION",
      parentId: orgId,
      depth: 1,
      childCount: division.departments.length,
      draggable: false,
    });

    for (const dept of division.departments) {
      appendDepartment(nodes, dept, "DIVISION", division.id, 2);
    }
  }

  for (const dept of tree.unassignedDepartments) {
    appendDepartment(nodes, dept, "ORGANIZATION", orgId, 1);
  }

  return nodes;
}

function appendDepartment(
  nodes: TreeNodeData[],
  dept: OrgTree["divisions"][0]["departments"][0],
  parentType: NodeType,
  parentId: string,
  depth: number
) {
  nodes.push({
    id: dept.id,
    name: dept.name,
    type: "DEPARTMENT",
    parentType,
    parentId,
    depth,
    childCount: dept.teams.length,
    draggable: true,
  });

  for (const team of dept.teams) {
    nodes.push({
      id: team.id,
      name: team.name,
      type: "TEAM",
      parentType: "DEPARTMENT",
      parentId: dept.id,
      depth: depth + 1,
      childCount: team.users.length,
      draggable: true,
    });

    for (const user of team.users) {
      nodes.push({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        type: "USER",
        parentType: "TEAM",
        parentId: team.id,
        depth: depth + 2,
        email: user.email,
        role: user.role,
        draggable: true,
      });
    }
  }
}

function isValidDrop(active: TreeNodeData, over: TreeNodeData): boolean {
  if (active.id === over.id) return false;

  const rules: Record<string, NodeType[]> = {
    DEPARTMENT: ["DIVISION", "ORGANIZATION"],
    TEAM: ["DEPARTMENT"],
    USER: ["TEAM"],
  };

  const allowedParents = rules[active.type];
  return !!allowedParents?.includes(over.type);
}

function buildMovePayload(active: TreeNodeData, over: TreeNodeData): MoveNodeRequest | null {
  if (!isValidDrop(active, over)) return null;

  if (active.type === "DEPARTMENT" && over.type === "ORGANIZATION") {
    return {
      nodeType: "DEPARTMENT",
      nodeId: active.id,
      targetParentType: "ORGANIZATION",
    };
  }

  if (active.type === "DEPARTMENT" && over.type === "DIVISION") {
    return {
      nodeType: "DEPARTMENT",
      nodeId: active.id,
      targetParentType: "DIVISION",
      targetParentId: over.id,
    };
  }

  if (active.type === "TEAM" && over.type === "DEPARTMENT") {
    return {
      nodeType: "TEAM",
      nodeId: active.id,
      targetParentType: "DEPARTMENT",
      targetParentId: over.id,
    };
  }

  if (active.type === "USER" && over.type === "TEAM") {
    return {
      nodeType: "USER",
      nodeId: active.id,
      targetParentType: "TEAM",
      targetParentId: over.id,
    };
  }

  return null;
}

function childTypeFor(type: NodeType): NodeType | null {
  if (type === "ORGANIZATION") return "DIVISION";
  if (type === "DIVISION") return "DEPARTMENT";
  if (type === "DEPARTMENT") return "TEAM";
  return null;
}

function addChildLabelFor(type: NodeType): string {
  const child = childTypeFor(type);
  if (child === "DIVISION") return "Add division";
  if (child === "DEPARTMENT") return "Add department";
  if (child === "TEAM") return "Add team";
  return "Add child";
}

const emptyDialogState: OrgNodeDialogState = {
  open: false,
  mode: "create",
  nodeType: "DIVISION",
};

export function OrgTree() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("org:write");
  const { data, isLoading, isError, refetch, moveNode, isFetching } = useOrgTree();
  const deleteDivision = useDeleteDivision();
  const deleteDepartment = useDeleteDepartment();
  const deleteTeam = useDeleteTeam();
  const [dialogState, setDialogState] = useState<OrgNodeDialogState>(emptyDialogState);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  const nodes = useMemo(() => (data ? buildTreeNodes(data) : []), [data]);
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const visibleNodes = useMemo(() => {
    if (nodes.length === 0) return [];

    const expandedSet = expanded.size > 0 ? expanded : new Set(nodes.map((n) => n.id));

    return nodes.filter((node) => {
      if (node.depth === 0) return true;
      let parentId = node.parentId;
      let parentType = node.parentType;
      while (parentId) {
        const parent = nodes.find((n) => n.id === parentId && n.type === parentType);
        if (!parent) break;
        if (!expandedSet.has(parent.id)) return false;
        parentId = parent.parentId;
        parentType = parent.parentType === "ROOT" ? "ORGANIZATION" : parent.parentType;
      }
      return true;
    });
  }, [nodes, expanded]);

  const childrenCount = useCallback(
    (node: TreeNodeData) =>
      nodes.filter((n) => n.parentId === node.id && n.parentType === node.type).length,
    [nodes]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const active = event.active.data.current as TreeNodeData | undefined;
    const overId = event.over?.id;
    if (!active || !overId) return;

    const overKey = String(overId).replace(/^drop-/, "");
    const over = nodeMap.get(overKey);
    if (!over) return;

    const payload = buildMovePayload(active, over);
    if (!payload) {
      toast.error("Invalid move target");
      return;
    }

    await moveNode.mutateAsync(payload);
  }

  function openCreate(parent: TreeNodeData) {
    const childType = childTypeFor(parent.type);
    if (!childType) return;
    setDialogState({
      open: true,
      mode: "create",
      nodeType: childType,
      parentId: parent.type === "ORGANIZATION" ? null : parent.id,
    });
  }

  function openRename(node: TreeNodeData) {
    setDialogState({
      open: true,
      mode: "rename",
      nodeType: node.type,
      nodeId: node.id,
      initialName: node.name,
    });
  }

  async function handleDelete(node: TreeNodeData) {
    if (!confirm(`Delete "${node.name}"? This cannot be undone.`)) return;
    try {
      if (node.type === "DIVISION") await deleteDivision.mutateAsync(node.id);
      else if (node.type === "DEPARTMENT") await deleteDepartment.mutateAsync(node.id);
      else if (node.type === "TEAM") await deleteTeam.mutateAsync(node.id);
    } catch {
      // toast handled in hook
    }
  }

  function nodeActions(node: TreeNodeData) {
    const child = childTypeFor(node.type);
    return {
      canWrite,
      onAddChild: child ? () => openCreate(node) : undefined,
      onRename: ["DIVISION", "DEPARTMENT", "TEAM"].includes(node.type)
        ? () => openRename(node)
        : undefined,
      onDelete: ["DIVISION", "DEPARTMENT", "TEAM"].includes(node.type)
        ? () => handleDelete(node)
        : undefined,
      addChildLabel: addChildLabelFor(node.type),
    };
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <p className="text-muted-foreground text-sm">Unable to load organization tree.</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activeNode = activeId ? nodeMap.get(activeId) : null;

  return (
    <>
      <OrgNodeDialog
        state={dialogState}
        onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
      />
      <Card className="shadow-luxury">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-medium">Organization structure</CardTitle>
          <div className="flex items-center gap-2">
            {canWrite && data && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  openCreate({
                    id: data.organization.id,
                    name: data.organization.name,
                    type: "ORGANIZATION",
                    parentType: "ROOT",
                    parentId: null,
                    depth: 0,
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add division
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-0.5">
            {visibleNodes.map((node) => (
              <div key={node.id} style={{ paddingLeft: `${node.depth * 20}px` }}>
                <TreeNode
                  node={node}
                  isExpanded={expanded.has(node.id)}
                  onToggle={() => toggle(node.id)}
                  hasChildren={childrenCount(node) > 0}
                  canDrop={
                    activeNode
                      ? !!buildMovePayload(activeNode, node)
                      : false
                  }
                  {...nodeActions(node)}
                />
              </div>
            ))}
          </div>
          <DragOverlay>
            {activeNode ? (
              <div className="rounded-lg border border-indigo/30 bg-card px-3 py-2 text-sm shadow-luxury-lg">
                {activeNode.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        <p className="text-muted-foreground mt-4 text-xs">
          {canWrite
            ? "Right-click nodes to add, rename, or delete. Drag departments, teams, or users to reorganize."
            : "Drag departments, teams, or users onto valid parent nodes. Changes sync immediately."}
        </p>
      </CardContent>
    </Card>
    </>
  );
}
