"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Copy, Move, Pencil, Plus, Trash2 } from "lucide-react";
import type { NodeType } from "@/types";

interface OrgContextMenuProps {
  children: React.ReactNode;
  label: string;
  nodeType: NodeType;
  canWrite?: boolean;
  canMove?: boolean;
  onAddChild?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  addChildLabel?: string;
}

export function OrgContextMenu({
  children,
  label,
  nodeType,
  canWrite = false,
  canMove = true,
  onAddChild,
  onRename,
  onDelete,
  addChildLabel,
}: OrgContextMenuProps) {
  const showCrud = canWrite && nodeType !== "USER";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem disabled className="text-muted-foreground text-xs">
          {label}
        </ContextMenuItem>
        <ContextMenuSeparator />
        {showCrud && onAddChild && (
          <ContextMenuItem onClick={onAddChild}>
            <Plus className="mr-2 h-4 w-4" />
            {addChildLabel ?? "Add child"}
          </ContextMenuItem>
        )}
        {showCrud && onRename && nodeType !== "ORGANIZATION" && (
          <ContextMenuItem onClick={onRename}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </ContextMenuItem>
        )}
        {showCrud && onDelete && nodeType !== "ORGANIZATION" && (
          <ContextMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </ContextMenuItem>
        )}
        {canMove && nodeType !== "ORGANIZATION" && nodeType !== "DIVISION" && (
          <ContextMenuItem disabled>
            <Move className="mr-2 h-4 w-4" />
            Drag to move
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => navigator.clipboard.writeText(label)}>
          <Copy className="mr-2 h-4 w-4" />
          Copy name
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
