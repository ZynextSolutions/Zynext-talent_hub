"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Layers,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { OrgContextMenu } from "@/components/org-tree/context-menu";
import type { NodeType, UserRole } from "@/types";

export interface TreeNodeData {
  id: string;
  name: string;
  type: NodeType;
  parentType: NodeType | "ROOT";
  parentId: string | null;
  depth: number;
  email?: string;
  role?: UserRole;
  childCount?: number;
  draggable?: boolean;
}

interface TreeNodeProps {
  node: TreeNodeData;
  isExpanded: boolean;
  onToggle: () => void;
  hasChildren: boolean;
  isDragging?: boolean;
  isOver?: boolean;
  canDrop?: boolean;
  canWrite?: boolean;
  onAddChild?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  addChildLabel?: string;
}

const typeIcons: Record<NodeType, React.ElementType> = {
  ORGANIZATION: Building2,
  DIVISION: Layers,
  DEPARTMENT: Building2,
  TEAM: Users,
  USER: User,
};

const typeColors: Record<NodeType, string> = {
  ORGANIZATION: "text-indigo",
  DIVISION: "text-violet-400",
  DEPARTMENT: "text-blue-400",
  TEAM: "text-emerald-400",
  USER: "text-muted-foreground",
};

export function TreeNode({
  node,
  isExpanded,
  onToggle,
  hasChildren,
  isDragging,
  isOver,
  canDrop,
  canWrite,
  onAddChild,
  onRename,
  onDelete,
  addChildLabel,
}: TreeNodeProps) {
  const Icon = typeIcons[node.type];
  const draggable = node.draggable !== false && ["DEPARTMENT", "TEAM", "USER"].includes(node.type);

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging: dragging } =
    useDraggable({
      id: node.id,
      data: node,
      disabled: !draggable,
    });

  const { setNodeRef: setDropRef, isOver: dropOver } = useDroppable({
    id: `drop-${node.id}`,
    data: node,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const setRefs = (el: HTMLDivElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  const content = (
    <div
      ref={setRefs}
      style={style}
      className={cn(
        "group flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm transition-colors",
        (isDragging || dragging) && "opacity-50 ring-2 ring-indigo/40",
        (isOver || dropOver) && canDrop && "border-indigo/40 bg-indigo/10",
        !isDragging && !dragging && "hover:bg-secondary/80"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground",
          !hasChildren && "invisible"
        )}
        aria-label={isExpanded ? "Collapse" : "Expand"}
      >
        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>

      {draggable && (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground flex h-5 w-5 shrink-0 cursor-grab items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          {...listeners}
          {...attributes}
          aria-label="Drag to move"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}

      <Icon className={cn("h-4 w-4 shrink-0", typeColors[node.type])} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{node.name}</span>
          {node.role && (
            <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">
              {node.role}
            </Badge>
          )}
        </div>
        {node.email && (
          <p className="text-muted-foreground truncate text-xs">{node.email}</p>
        )}
      </div>

      {node.childCount !== undefined && node.childCount > 0 && (
        <span className="text-muted-foreground text-xs tabular-nums">{node.childCount}</span>
      )}
    </div>
  );

  return (
    <OrgContextMenu
      label={node.name}
      nodeType={node.type}
      canWrite={canWrite}
      canMove={draggable}
      onAddChild={onAddChild}
      onRename={onRename}
      onDelete={onDelete}
      addChildLabel={addChildLabel}
    >
      {content}
    </OrgContextMenu>
  );
}
