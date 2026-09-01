"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, MoreHorizontal, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EditUserDialog } from "@/components/users/edit-user-dialog";
import { ImportUsersDialog } from "@/components/users/import-users-dialog";
import { InviteUserDialog } from "@/components/users/invite-user-dialog";
import {
  useActivateUser,
  useBulkUserStatus,
  useDeleteUser,
  useExportUsers,
  useResendInvite,
  useSuspendUser,
  useUnlockUser,
  useUsers,
} from "@/hooks/useUsers";
import { useAuth } from "@/hooks/useAuth";
import { canAdministerUser, formatRole } from "@/lib/roles";
import { formatDate, getInitials } from "@/lib/utils";
import { resolveAssetUrl } from "@/lib/certificate-template";
import type { User, UserRole, UserStatus } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  INVITED: "secondary",
  SUSPENDED: "destructive",
  DEACTIVATED: "outline",
};

const ROLES: UserRole[] = ["ORG_ADMIN", "MANAGER", "INSTRUCTOR", "EMPLOYEE"];
const STATUSES: UserStatus[] = ["ACTIVE", "INVITED", "SUSPENDED", "DEACTIVATED"];

export default function UsersPage() {
  const { user: actor, hasPermission } = useAuth();
  const canWrite = hasPermission("user:write");
  const canInvite = hasPermission("user:invite");
  const canExport = hasPermission("user:read");

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
    pageSize: 25,
    q: q || undefined,
    role: roleFilter === ALL ? undefined : (roleFilter as UserRole),
    status: statusFilter === ALL ? undefined : (statusFilter as UserStatus),
  });

  const totalPages = data?.totalPages ?? 1;

  const suspendUser = useSuspendUser();
  const resendInvite = useResendInvite();
  const activateUser = useActivateUser();
  const deleteUser = useDeleteUser();
  const unlockUser = useUnlockUser();
  const bulkStatus = useBulkUserStatus();
  const exportUsers = useExportUsers();

  const users = useMemo(() => data?.items ?? [], [data?.items]);

  const administrableUsers = useMemo(
    () => users.filter((user) => canAdministerUser(actor?.role, user.role)),
    [users, actor?.role],
  );

  const selectedAdministrable = useMemo(
    () => [...selectedIds].filter((id) => administrableUsers.some((user) => user.id === id)),
    [selectedIds, administrableUsers],
  );

  const allSelected =
    administrableUsers.length > 0 &&
    administrableUsers.every((user) => selectedIds.has(user.id));

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(administrableUsers.map((user) => user.id)));
  }

  function toggleOne(userId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

  async function handleBulkStatus(status: UserStatus) {
    if (!selectedAdministrable.length) return;
    try {
      await bulkStatus.mutateAsync({ userIds: selectedAdministrable, status });
      setSelectedIds(new Set());
    } catch {
      // toast handled in hook
    }
  }

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {canExport && (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={exportUsers.isPending}
            onClick={() => exportUsers.mutate()}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          {canWrite && <ImportUsersDialog />}
        </>
      )}
      {canInvite && <InviteUserDialog />}
    </div>
  );

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Users"
        description="Manage team members, roles, and invitations."
        actions={headerActions}
      />
      {editingUser && (
        <EditUserDialog
          user={editingUser}
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
        />
      )}
      <div className="space-y-3 px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users"
              className="pl-8"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[160px]">
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
            <SelectTrigger className="w-[160px]">
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

        {canWrite && selectedAdministrable.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2">
            <span className="text-muted-foreground text-sm">
              {selectedAdministrable.length} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkStatus.isPending}
              onClick={() => handleBulkStatus("ACTIVE")}
            >
              Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkStatus.isPending}
              onClick={() => handleBulkStatus("SUSPENDED")}
            >
              Suspend
            </Button>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card shadow-luxury">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {canWrite && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all users"
                      disabled={!administrableUsers.length}
                    />
                  </TableHead>
                )}
                <TableHead className="h-9">User</TableHead>
                <TableHead className="h-9">Role</TableHead>
                <TableHead className="h-9">Status</TableHead>
                <TableHead className="hidden h-9 md:table-cell">Last login</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={canWrite ? 6 : 5}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : users.length ? (
                users.map((user) => {
                  const canManage = canWrite && canAdministerUser(actor?.role, user.role);
                  return (
                    <TableRow key={user.id}>
                      {canWrite && (
                        <TableCell>
                          {canManage ? (
                            <Checkbox
                              checked={selectedIds.has(user.id)}
                              onCheckedChange={(checked) => toggleOne(user.id, checked)}
                              aria-label={`Select ${user.email}`}
                            />
                          ) : null}
                        </TableCell>
                      )}
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            {user.avatarUrl ? (
                              <AvatarImage src={resolveAssetUrl(user.avatarUrl)} alt="" />
                            ) : null}
                            <AvatarFallback className="bg-indigo/15 text-indigo text-xs">
                              {getInitials(user.firstName, user.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className="text-xs">{user.role}</Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant={statusVariant[user.status] ?? "secondary"} className="text-xs">
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden py-2 text-xs md:table-cell">
                        {user.lastLoginAt ? formatDate(user.lastLoginAt) : "—"}
                      </TableCell>
                      <TableCell>
                        {canManage ? (
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
                              {user.status === "INVITED" && (
                                <DropdownMenuItem onClick={() => resendInvite.mutate({ id: user.id })}>
                                  Resend invite
                                </DropdownMenuItem>
                              )}
                              {user.status === "SUSPENDED" && (
                                <DropdownMenuItem onClick={() => activateUser.mutate({ id: user.id })}>
                                  Activate
                                </DropdownMenuItem>
                              )}
                              {user.status === "ACTIVE" && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => suspendUser.mutate({ id: user.id })}
                                >
                                  Suspend
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => unlockUser.mutate({ id: user.id })}>
                                Unlock account
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  if (confirm(`Delete ${user.email}?`)) deleteUser.mutate({ id: user.id });
                                }}
                              >
                                Delete user
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={canWrite ? 6 : 5}
                    className="text-muted-foreground h-24 text-center"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={data?.total}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
