"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TablePaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  totalItems?: number;
}

export function TablePagination({
  page,
  totalPages,
  onPageChange,
  className,
  totalItems,
}: TablePaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-t border-border px-3 py-2",
        className,
      )}
    >
      {totalItems != null ? (
        <span className="text-muted-foreground text-xs tabular-nums">{totalItems} total</span>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-muted-foreground px-2 text-xs tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
