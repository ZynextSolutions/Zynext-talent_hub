"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
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
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function resetForm() {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setAdminEmail("");
    setAdminFirstName("");
    setAdminLastName("");
    setAcceptUrl(null);
    setCopied(false);
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = await createOrg.mutateAsync({
      name,
      slug,
      adminEmail,
      adminFirstName,
      adminLastName,
    });
    setAcceptUrl(data.invite.acceptUrl);
  }

  async function copyLink() {
    if (!acceptUrl) return;
    await navigator.clipboard.writeText(acceptUrl);
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="bg-violet-600 hover:bg-violet-700">
          <Plus className="mr-2 h-4 w-4" />
          New organization
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {acceptUrl ? (
          <>
            <DialogHeader>
              <DialogTitle>Organization created</DialogTitle>
              <DialogDescription>
                An invite email was queued for {adminEmail}. If Resend is not configured, send this
                link manually — the admin sets their password here.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label>Accept invite link</Label>
              <div className="flex gap-2">
                <Input readOnly value={acceptUrl} className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={() => void copyLink()}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Create organization</DialogTitle>
              <DialogDescription>
                Provision a new tenant. The org admin receives an invite to set their password.
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
        )}
      </DialogContent>
    </Dialog>
  );
}
