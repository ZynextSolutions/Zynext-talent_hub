"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CatalogFilters = {
  availability?: "open" | "upcoming";
  enrolled?: boolean;
  prerequisitesMet?: boolean;
  duration?: "short" | "medium" | "long";
};

const CHIPS: Array<{
  id: string;
  label: string;
  apply: (current: CatalogFilters) => CatalogFilters;
  isActive: (current: CatalogFilters) => boolean;
}> = [
  {
    id: "open",
    label: "Available now",
    apply: (current) => ({
      ...current,
      availability: current.availability === "open" ? undefined : "open",
    }),
    isActive: (current) => current.availability === "open",
  },
  {
    id: "upcoming",
    label: "Coming soon",
    apply: (current) => ({
      ...current,
      availability: current.availability === "upcoming" ? undefined : "upcoming",
    }),
    isActive: (current) => current.availability === "upcoming",
  },
  {
    id: "enrolled",
    label: "My courses",
    apply: (current) => ({
      ...current,
      enrolled: current.enrolled === true ? undefined : true,
    }),
    isActive: (current) => current.enrolled === true,
  },
  {
    id: "ready",
    label: "Ready to start",
    apply: (current) => ({
      ...current,
      prerequisitesMet: current.prerequisitesMet ? undefined : true,
    }),
    isActive: (current) => current.prerequisitesMet === true,
  },
  {
    id: "short",
    label: "≤ 30 min",
    apply: (current) => ({
      ...current,
      duration: current.duration === "short" ? undefined : "short",
    }),
    isActive: (current) => current.duration === "short",
  },
  {
    id: "medium",
    label: "31–120 min",
    apply: (current) => ({
      ...current,
      duration: current.duration === "medium" ? undefined : "medium",
    }),
    isActive: (current) => current.duration === "medium",
  },
  {
    id: "long",
    label: "2+ hours",
    apply: (current) => ({
      ...current,
      duration: current.duration === "long" ? undefined : "long",
    }),
    isActive: (current) => current.duration === "long",
  },
];

export function hasActiveCatalogFilters(filters: CatalogFilters) {
  return Boolean(
    filters.availability || filters.enrolled || filters.prerequisitesMet || filters.duration,
  );
}

export function CatalogFiltersBar({
  filters,
  onChange,
}: {
  filters: CatalogFilters;
  onChange: (next: CatalogFilters) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-6 pb-2">
      {CHIPS.map((chip) => {
        const active = chip.isActive(filters);
        return (
          <Button
            key={chip.id}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            className={cn("h-8 rounded-full px-3 text-xs", active && "shadow-sm")}
            onClick={() => onChange(chip.apply(filters))}
          >
            {chip.label}
          </Button>
        );
      })}
      {hasActiveCatalogFilters(filters) ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground h-8 px-2 text-xs"
          onClick={() => onChange({})}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
