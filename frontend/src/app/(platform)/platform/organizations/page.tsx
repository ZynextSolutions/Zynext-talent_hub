"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CreateOrganizationDialog } from "@/components/platform/create-organization-dialog";
import { EditOrganizationDialog } from "@/components/platform/edit-organization-dialog";
import { OrganizationDetailSheet } from "@/components/platform/organization-detail-sheet";
import {
  useDeletePlatformOrganization,
  usePatchPlatformOrganization,
  usePlatformOrganizations,
} from "@/hooks/usePlatform";
import { formatDate } from "@/lib/utils";
import type { PlatformOrganization } from "@/types";
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

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  SUSPENDED: "destructive",
};

export default function PlatformOrganizationsPage() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editingOrg, setEditingOrg] = useState<PlatformOrganization | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter]);

  const { data, isLoading } = usePlatformOrganizations({
    page,
    pageSize: PAGE_SIZE,
    q: q || undefined,
    status: statusFilter === ALL ? undefined : statusFilter,
  });

  const patchOrg = usePatchPlatformOrganization();
  const deleteOrg = useDeletePlatformOrganization();

  const orgs = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const viewingPreview = viewingId ? orgs.find((o) => o.id === viewingId) ?? null : null;

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Organizations"
        description="Create, view, edit, suspend, and delete tenant organizations."
        actions={<CreateOrganizationDialog />}
      />
      <div className="flex-1 space-y-4 px-6 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 h-4 w-4" />
            <Input
              className="pl-9"
              placeholder="Search by name or slug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-luxury">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Users</TableHead>
                <TableHead className="hidden md:table-cell">Courses</TableHead>
                <TableHead className="hidden lg:table-cell">Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : orgs.length ? (
                orgs.map((org) => (
                  <TableRow
                    key={org.id}
                    className="cursor-pointer"
                    onClick={() => setViewingId(org.id)}
                  >
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell className="text-muted-foreground">{org.slug}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[org.status ?? "ACTIVE"] ?? "secondary"}>
                        {org.status ?? "ACTIVE"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{org.userCount}</TableCell>
                    <TableCell className="hidden md:table-cell">{org.courseCount}</TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell text-sm">
                      {org.createdAt ? formatDate(org.createdAt) : "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewingId(org.id)}>
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingOrg(org)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/platform/organizations/${org.id}/users`}>
                              Manage users
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {org.status === "SUSPENDED" ? (
                            <DropdownMenuItem
                              onClick={() => patchOrg.mutate({ id: org.id, status: "ACTIVE" })}
                            >
                              Activate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => patchOrg.mutate({ id: org.id, status: "SUSPENDED" })}
                            >
                              Suspend
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              if (
                                confirm(
                                  `Delete organization "${org.name}"? This cannot be undone.`,
                                )
                              ) {
                                deleteOrg.mutate(org.id);
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
                  <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                    No organizations found.
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

      <OrganizationDetailSheet
        organizationId={viewingId}
        open={Boolean(viewingId)}
        onOpenChange={(open) => {
          if (!open) setViewingId(null);
        }}
        preview={viewingPreview}
        onEdit={(org) => {
          setEditingOrg(org);
        }}
      />

      {editingOrg ? (
        <EditOrganizationDialog
          organization={editingOrg}
          open={Boolean(editingOrg)}
          onOpenChange={(open) => {
            if (!open) setEditingOrg(null);
          }}
        />
      ) : null}
    </div>
  );
}
