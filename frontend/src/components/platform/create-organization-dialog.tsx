"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreatePlatformOrganization } from "@/hooks/usePlatform";
import { slugify } from "@/lib/utils";

export function CreateOrganizationDialog() {
  const createOrg = useCreatePlatformOrganization();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");

  function resetForm() {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setAdminEmail("");
    setAdminFirstName("");
    setAdminLastName("");
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createOrg.mutateAsync({
      name,
      slug,
      adminEmail,
      adminFirstName,
      adminLastName,
    });
    setOpen(false);
    resetForm();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-violet-600 hover:bg-violet-700">
          <Plus className="mr-2 h-4 w-4" />
          New organization
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
            <DialogDescription>
              Provision a new tenant. The org admin will receive an invite email.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization name</Label>
              <Input id="orgName" value={name} onChange={(e) => handleNameChange(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgSlug">Slug</Label>
              <Input
                id="orgSlug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                required
                pattern="^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adminFirstName">Admin first name</Label>
                <Input
                  id="adminFirstName"
                  value={adminFirstName}
                  onChange={(e) => setAdminFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminLastName">Admin last name</Label>
                <Input
                  id="adminLastName"
                  value={adminLastName}
                  onChange={(e) => setAdminLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Admin email</Label>
              <Input
                id="adminEmail"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createOrg.isPending}>
              {createOrg.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Creating…
                </>
              ) : (
                "Create organization"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
