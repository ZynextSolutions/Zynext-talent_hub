"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Course } from "@/types";

interface PathCoursePickerProps {
  courses: Course[];
  excludedCourseIds: Set<string>;
  disabled?: boolean;
  pending?: boolean;
  onAdd: (courseIds: string[]) => void | Promise<void>;
}

export function PathCoursePicker({
  courses,
  excludedCourseIds,
  disabled,
  pending,
  onAdd,
}: PathCoursePickerProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter(
      (course) =>
        !excludedCourseIds.has(course.id) &&
        (!q || course.title.toLowerCase().includes(q)),
    );
  }, [courses, excludedCourseIds, search]);

  async function handleAdd() {
    if (!selected.size) return;
    await onAdd([...selected]);
    setSelected(new Set());
    setSearch("");
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <Input
        placeholder="Search published courses…"
        value={search}
        disabled={disabled}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ScrollArea className="h-44 rounded-md border border-border">
        <div className="space-y-2 p-3">
          {available.length ? (
            available.map((course) => {
              const checked = selected.has(course.id);
              return (
                <label key={course.id} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    disabled={disabled || pending}
                    onCheckedChange={(next) => {
                      setSelected((prev) => {
                        const copy = new Set(prev);
                        if (next) copy.add(course.id);
                        else copy.delete(course.id);
                        return copy;
                      });
                    }}
                  />
                  <span>{course.title}</span>
                </label>
              );
            })
          ) : (
            <p className="text-muted-foreground text-xs">No matching courses.</p>
          )}
        </div>
      </ScrollArea>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || pending || selected.size === 0}
        onClick={handleAdd}
      >
        {pending ? (
          <>
            <Loader2 className="animate-spin" />
            Adding…
          </>
        ) : (
          `Add ${selected.size || ""} course${selected.size === 1 ? "" : "s"}`.trim()
        )}
      </Button>
    </div>
  );
}
