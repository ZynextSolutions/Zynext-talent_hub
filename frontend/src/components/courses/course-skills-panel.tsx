"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useCourseSkills, useSetCourseSkills, useSkills } from "@/hooks/usePhase3";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function CourseSkillsPanel({ courseId, canWrite }: { courseId: string; canWrite: boolean }) {
  const { data: allSkills, isLoading: loadingCatalog } = useSkills(true);
  const { data: mapped, isLoading: loadingMapped } = useCourseSkills(courseId);
  const setSkills = useSetCourseSkills(courseId);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (mapped) setSelected(new Set(mapped.map((row) => row.skillId)));
  }, [mapped]);

  const loading = loadingCatalog || loadingMapped;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h3 className="text-base font-semibold">Skills taught</h3>
        <p className="text-muted-foreground text-sm">
          Learners who complete this course will demonstrate these skills.{" "}
          <Link href="/skills" className="underline">
            Manage skill catalog
          </Link>
        </p>
      </div>
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading skills…</p>
      ) : allSkills?.length ? (
        <div className="space-y-2 rounded-lg border border-border p-4">
          {allSkills.map((skill) => (
            <label key={skill.id} className="flex items-center gap-3 text-sm">
              <Checkbox
                disabled={!canWrite}
                checked={selected.has(skill.id)}
                onCheckedChange={(checked) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (checked) next.add(skill.id);
                    else next.delete(skill.id);
                    return next;
                  })
                }
              />
              <span>
                <span className="font-medium">{skill.name}</span>
                {skill.category ? (
                  <span className="text-muted-foreground ml-2 text-xs">{skill.category}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          No skills in your catalog yet.{" "}
          <Link href="/skills" className="underline">
            Add skills
          </Link>{" "}
          first.
        </p>
      )}
      {canWrite && allSkills?.length ? (
        <Button
          type="button"
          disabled={setSkills.isPending}
          onClick={() =>
            setSkills.mutate([...selected].map((skillId) => ({ skillId, level: 1 })))
          }
        >
          {setSkills.isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Saving…
            </>
          ) : (
            "Save skills"
          )}
        </Button>
      ) : null}
      {!canWrite && mapped?.length ? (
        <div className="space-y-1">
          <Label>Mapped skills</Label>
          <ul className="text-muted-foreground list-inside list-disc text-sm">
            {mapped.map((row) => (
              <li key={row.skillId}>{row.name}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
