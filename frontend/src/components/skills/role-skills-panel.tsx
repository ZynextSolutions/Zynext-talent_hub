"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useOrgRoles, useRoleSkills, useSetRoleSkills, useSkills } from "@/hooks/usePhase3";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RoleSkillsPanel({ canWrite }: { canWrite: boolean }) {
  const { data: roles } = useOrgRoles(true);
  const { data: skills } = useSkills(true);
  const [roleId, setRoleId] = useState("");
  const { data: mapped, isLoading } = useRoleSkills(roleId, !!roleId);
  const setRoleSkills = useSetRoleSkills(roleId);
  const [selected, setSelected] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!roleId && roles?.length) setRoleId(roles[0]!.id);
  }, [roles, roleId]);

  useEffect(() => {
    if (mapped) setSelected(new Map(mapped.map((r) => [r.skillId, r.requiredLevel])));
  }, [mapped]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-luxury">
      <h3 className="text-base font-semibold">Role requirements</h3>
      <p className="text-muted-foreground mb-4 text-sm">
        Define which skills each role must demonstrate. Gap analytics use these mappings.
      </p>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {roles?.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name} ({role.userCount} users)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading requirements…</p>
        ) : skills?.length ? (
          <div className="space-y-3">
            {skills.map((skill) => {
              const checked = selected.has(skill.id);
              return (
                <div key={skill.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    <Checkbox
                      disabled={!canWrite}
                      checked={checked}
                      onCheckedChange={(value) =>
                        setSelected((prev) => {
                          const next = new Map(prev);
                          if (value) next.set(skill.id, next.get(skill.id) ?? 1);
                          else next.delete(skill.id);
                          return next;
                        })
                      }
                    />
                    <span className="font-medium">{skill.name}</span>
                  </label>
                  {checked && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Level</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        className="h-8 w-16"
                        disabled={!canWrite}
                        value={selected.get(skill.id) ?? 1}
                        onChange={(e) =>
                          setSelected((prev) => {
                            const next = new Map(prev);
                            next.set(skill.id, Math.max(1, Math.min(5, Number(e.target.value) || 1)));
                            return next;
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Add skills to the catalog first.</p>
        )}
        {canWrite && roleId && skills?.length ? (
          <Button
            type="button"
            size="sm"
            disabled={setRoleSkills.isPending}
            onClick={() =>
              setRoleSkills.mutate(
                [...selected.entries()].map(([skillId, requiredLevel]) => ({ skillId, requiredLevel })),
              )
            }
          >
            {setRoleSkills.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Saving…
              </>
            ) : (
              "Save role requirements"
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
