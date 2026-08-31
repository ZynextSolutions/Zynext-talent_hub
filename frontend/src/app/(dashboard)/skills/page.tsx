"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { useCreateSkill, useDeleteSkill, useSkills } from "@/hooks/usePhase3";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleSkillsPanel } from "@/components/skills/role-skills-panel";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function SkillsPage() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("skills:write");
  const { data, isLoading } = useSkills(hasPermission("skills:read"));
  const createSkill = useCreateSkill();
  const deleteSkill = useDeleteSkill();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [code, setCode] = useState("");

  if (!hasPermission("skills:read")) {
    return (
      <div className="flex flex-1 flex-col overflow-auto">
        <PageHeader title="Skills" description="You do not have permission to view skills." />
      </div>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await createSkill.mutateAsync({
      name: name.trim(),
      category: category.trim() || undefined,
      code: code.trim() || undefined,
    });
    setName("");
    setCategory("");
    setCode("");
    setOpen(false);
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Skills"
        description="Define competencies and map them to courses and roles."
        actions={
          canWrite ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Add skill
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCreate}>
                  <DialogHeader>
                    <DialogTitle>New skill</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="skillName">Name</Label>
                      <Input id="skillName" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="skillCode">Code</Label>
                      <Input id="skillCode" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SEC-101" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="skillCategory">Category</Label>
                      <Input id="skillCategory" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Security" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createSkill.isPending}>
                      {createSkill.isPending ? (
                        <>
                          <Loader2 className="animate-spin" />
                          Creating…
                        </>
                      ) : (
                        "Create"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />
      <div className="flex-1 px-6 py-4">
        <Tabs defaultValue="catalog">
          <TabsList>
            <TabsTrigger value="catalog">Skill catalog</TabsTrigger>
            <TabsTrigger value="roles">Role requirements</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="mt-4">
            <div className="rounded-xl border border-border bg-card shadow-luxury">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-9">Name</TableHead>
                    <TableHead className="hidden h-9 sm:table-cell">Code</TableHead>
                    <TableHead className="hidden h-9 md:table-cell">Category</TableHead>
                    <TableHead className="h-9 text-right">Courses</TableHead>
                    <TableHead className="h-9 text-right">Roles</TableHead>
                    {canWrite && <TableHead className="h-9 w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={canWrite ? 6 : 5}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : data?.length ? (
                    data.map((skill) => (
                      <TableRow key={skill.id}>
                        <TableCell className="max-w-[14rem] truncate py-2 text-sm font-medium">{skill.name}</TableCell>
                        <TableCell className="text-muted-foreground hidden py-2 text-xs sm:table-cell">{skill.code ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground hidden py-2 text-xs md:table-cell">{skill.category ?? "—"}</TableCell>
                        <TableCell className="py-2 text-right text-sm tabular-nums">{skill.courseCount ?? 0}</TableCell>
                        <TableCell className="py-2 text-right text-sm tabular-nums">{skill.roleCount ?? 0}</TableCell>
                        {canWrite && (
                          <TableCell className="py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label="Delete skill"
                              disabled={deleteSkill.isPending}
                              onClick={() => deleteSkill.mutate(skill.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={canWrite ? 6 : 5} className="text-muted-foreground h-20 text-center text-sm">
                        No skills yet. {canWrite ? "Add your first skill to start tracking coverage." : ""}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="roles" className="mt-4">
            <RoleSkillsPanel canWrite={canWrite} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
