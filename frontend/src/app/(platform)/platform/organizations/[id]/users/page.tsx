"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MoreHorizontal, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EditUserDialog } from "@/components/users/edit-user-dialog";
import { InviteUserDialog } from "@/components/users/invite-user-dialog";
import { usePlatformOrganization } from "@/hooks/usePlatform";
import {
  useActivateUser,
  useDeleteUser,
  useResendInvite,
  useSuspendUser,
  useUnlockUser,
  useUsers,
} from "@/hooks/useUsers";
import { formatRole } from "@/lib/roles";
import { formatDate, getInitials } from "@/lib/utils";
import type { User, UserRole, UserStatus } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ALL = "all";
const PAGE_SIZE = 25;

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  INVITED: "secondary",
  SUSPENDED: "destructive",
  DEACTIVATED: "outline",
};

const ROLES: UserRole[] = ["ORG_ADMIN", "MANAGER", "INSTRUCTOR", "EMPLOYEE"];
const STATUSES: UserStatus[] = ["ACTIVE", "INVITED", "SUSPENDED", "DEACTIVATED"];

export default function PlatformOrganizationUsersPage() {
  const params = useParams();
  const organizationId = typeof params.id === "string" ? params.id : "";

  const { data: org, isLoading: orgLoading } = usePlatformOrganization(organizationId || null);

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [q, roleFilter, statusFilter]);

  const { data, isLoading } = useUsers({
    page,
    pageSize: PAGE_SIZE,
    q: q || undefined,
    role: roleFilter === ALL ? undefined : (roleFilter as UserRole),
    status: statusFilter === ALL ? undefined : (statusFilter as UserStatus),
    organizationId: organizationId || undefined,
  });

  const suspendUser = useSuspendUser();
  const resendInvite = useResendInvite();
  const activateUser = useActivateUser();
  const deleteUser = useDeleteUser();
  const unlockUser = useUnlockUser();

  const users = useMemo(() => data?.items ?? [], [data?.items]);
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title={orgLoading ? "Users" : `${org?.name ?? "Organization"} — Users`}
        description="Invite and manage users in this tenant organization."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/organizations">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Organizations
              </Link>
            </Button>
            {organizationId ? <InviteUserDialog organizationId={organizationId} /> : null}
          </div>
        }
      />

      <div className="flex-1 space-y-4 px-6 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 h-4 w-4" />
            <Input
              className="pl-9"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All roles</SelectItem>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {formatRole(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-luxury">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : users.length ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(user.firstName, user.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatRole(user.role)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[user.status] ?? "secondary"}>{user.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                      {user.createdAt ? formatDate(user.createdAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingUser(user)}>
                            Edit user
                          </DropdownMenuItem>
                          {user.status === "INVITED" ? (
                            <DropdownMenuItem
                              onClick={() =>
                                resendInvite.mutate({ id: user.id, organizationId })
                              }
                            >
                              Resend invite
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          {user.status === "SUSPENDED" ? (
                            <DropdownMenuItem
                              onClick={() =>
                                activateUser.mutate({ id: user.id, organizationId })
                              }
                            >
                              Activate
                            </DropdownMenuItem>
                          ) : null}
                          {user.status === "ACTIVE" ? (
                            <DropdownMenuItem
                              onClick={() =>
                                suspendUser.mutate({ id: user.id, organizationId })
                              }
                            >
                              Suspend
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            onClick={() => unlockUser.mutate({ id: user.id, organizationId })}
                          >
                            Unlock account
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              if (confirm(`Delete ${user.email}?`)) {
                                deleteUser.mutate({ id: user.id, organizationId });
                              }
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={data?.total}
          />
        </div>
      </div>

      {editingUser ? (
        <EditUserDialog
          user={editingUser}
          open={Boolean(editingUser)}
          onOpenChange={(open) => {
            if (!open) setEditingUser(null);
          }}
          organizationId={organizationId}
        />
      ) : null}
    </div>
  );
}
