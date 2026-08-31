"use client";

import { MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CreateOrganizationDialog } from "@/components/platform/create-organization-dialog";
import {
  useDeletePlatformOrganization,
  usePatchPlatformOrganization,
  usePlatformOrganizations,
} from "@/hooks/usePlatform";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  SUSPENDED: "destructive",
};

export default function PlatformOrganizationsPage() {
  const { data, isLoading } = usePlatformOrganizations({ page: 1 });
  const patchOrg = usePatchPlatformOrganization();
  const deleteOrg = useDeletePlatformOrganization();

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Organizations"
        description="Create, suspend, and manage tenant organizations."
        actions={<CreateOrganizationDialog />}
      />
      <div className="flex-1 px-6 py-6">
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
              ) : data?.items?.length ? (
                data.items.map((org) => (
                  <TableRow key={org.id}>
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
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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
                              if (confirm(`Delete organization "${org.name}"? This cannot be undone.`)) {
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
        </div>
      </div>
    </div>
  );
}
