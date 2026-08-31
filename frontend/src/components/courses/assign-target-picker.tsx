"use client";

import { useMemo, useState } from "react";
import { Building2, Check, Layers, Search, User, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  assignTargetKey,
  assignTargetTypeLabel,
  filterAssignTargets,
  type AssignTarget,
  type AssignTargetFilter,
  type AssignTargetType,
} from "@/lib/org-targets";

const FILTERS: { id: AssignTargetFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "org", label: "Org units" },
  { id: "teams", label: "Teams" },
  { id: "people", label: "People" },
];

function TargetIcon({ type }: { type: AssignTargetType }) {
  const className = "text-muted-foreground h-4 w-4 shrink-0";
  if (type === "ORGANIZATION") return <Building2 className={className} />;
  if (type === "DIVISION") return <Layers className={className} />;
  if (type === "DEPARTMENT") return <Building2 className={className} />;
  if (type === "TEAM") return <Users className={className} />;
  return <User className={className} />;
}

interface AssignTargetPickerProps {
  targets: AssignTarget[];
  value: string;
  onChange: (key: string) => void;
  excludeKeys?: Set<string>;
  disabled?: boolean;
}

export function AssignTargetPicker({
  targets,
  value,
  onChange,
  excludeKeys,
  disabled,
}: AssignTargetPickerProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AssignTargetFilter>("all");

  const filtered = useMemo(
    () => filterAssignTargets(targets, { query, filter, excludeKeys }),
    [targets, query, filter, excludeKeys],
  );

  const selected = useMemo(
    () => targets.find((target) => assignTargetKey(target) === value),
    [targets, value],
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 h-4 w-4" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search org, team, or person…"
          className="pl-9"
          disabled={disabled}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => setFilter(item.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === item.id
                ? "border-indigo bg-indigo/10 text-indigo"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {selected && (
        <div className="rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-2 text-sm">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Selected</p>
          <p className="mt-1 font-medium">{selected.shortLabel}</p>
          <p className="text-muted-foreground text-xs">
            {assignTargetTypeLabel(selected.type)}
            {selected.path ? ` · ${selected.path}` : ""}
            {" · "}
            {selected.memberCount} learner{selected.memberCount === 1 ? "" : "s"}
          </p>
        </div>
      )}

      <ScrollArea className="h-56 rounded-lg border border-border">
        <div className="p-1">
          {filtered.length ? (
            filtered.map((target) => {
              const key = assignTargetKey(target);
              const active = value === key;
              const alreadyAssigned = excludeKeys?.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled || alreadyAssigned}
                  onClick={() => onChange(key)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                    active ? "bg-indigo/10 text-foreground" : "hover:bg-muted",
                    alreadyAssigned && "cursor-not-allowed opacity-50",
                  )}
                >
                  <TargetIcon type={target.type} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{target.shortLabel}</span>
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {assignTargetTypeLabel(target.type)}
                      </Badge>
                      {alreadyAssigned && (
                        <Badge variant="outline" className="text-[10px]">
                          Assigned
                        </Badge>
                      )}
                    </div>
                    {target.path && (
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">{target.path}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {target.memberCount}
                    </span>
                    {active && <Check className="text-indigo h-4 w-4" />}
                  </div>
                </button>
              );
            })
          ) : (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              {query ? "No targets match your search." : "No assignment targets available."}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
