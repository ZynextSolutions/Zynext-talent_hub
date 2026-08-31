"use client";

import { useMemo, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrgTree } from "@/hooks/useOrgTree";
import { useInviteUser } from "@/hooks/useUsers";
import { useAuth } from "@/hooks/useAuth";
import type { OrgTree, UserRole } from "@/types";
import { ApiClientError } from "@/lib/api-client";
import { assignableRoles, formatRole } from "@/lib/roles";
import { toast } from "sonner";

function flattenTeams(tree: OrgTree) {
  const options: { id: string; label: string }[] = [];

  const addDept = (dept: OrgTree["divisions"][0]["departments"][0], divisionName?: string) => {
    for (const team of dept.teams) {
      const path = divisionName
        ? `${divisionName} / ${dept.name} / ${team.name}`
        : `${dept.name} / ${team.name}`;
      options.push({ id: team.id, label: path });
    }
  };

  for (const division of tree.divisions) {
    for (const dept of division.departments) {
      addDept(dept, division.name);
    }
  }
  for (const dept of tree.unassignedDepartments) {
    addDept(dept);
  }

  return options;
}

export function InviteUserDialog() {
  const { user: actor, hasPermission } = useAuth();
  const { data: orgTree, isLoading: treeLoading } = useOrgTree(false);
  const inviteUser = useInviteUser();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<UserRole>("EMPLOYEE");
  const [teamId, setTeamId] = useState("");

  const teams = useMemo(() => (orgTree ? flattenTeams(orgTree) : []), [orgTree]);

  const availableRoles = assignableRoles(actor?.role);

  function resetForm() {
    setEmail("");
    setFirstName("");
    setLastName("");
    setRole("EMPLOYEE");
    setTeamId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId) {
      toast.error("Please select a team");
      return;
    }
    try {
      await inviteUser.mutateAsync({ email, firstName, lastName, role, teamId });
      setOpen(false);
      resetForm();
    } catch (err) {
      if (err instanceof ApiClientError) {
        toast.error(err.message);
      }
    }
  }

  if (!hasPermission("user:invite")) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite user
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <DialogDescription>
              Send an email invite. They will set their password when accepting.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {formatRole(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Team</Label>
              {treeLoading ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading teams…
                </div>
              ) : teams.length ? (
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No teams found. Add teams in Organization first.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={inviteUser.isPending || !teams.length}>
              {inviteUser.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Sending…
                </>
              ) : (
                "Send invite"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
