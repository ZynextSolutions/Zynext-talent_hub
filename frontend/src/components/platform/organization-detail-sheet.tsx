"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Building2, Loader2, Pencil, Users } from "lucide-react";
import {
  useDeletePlatformOrganization,
  usePatchPlatformOrganization,
  usePlatformOrganization,
} from "@/hooks/usePlatform";
import { formatDate } from "@/lib/utils";
import type { PlatformOrganization } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  SUSPENDED: "destructive",
};

interface OrganizationDetailSheetProps {
  organizationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (org: PlatformOrganization) => void;
  /** Prefer list-row data for instant display while detail loads. */
  preview?: PlatformOrganization | null;
}

export function OrganizationDetailSheet({
  organizationId,
  open,
  onOpenChange,
  onEdit,
  preview,
}: OrganizationDetailSheetProps) {
  const { data, isLoading, isError } = usePlatformOrganization(open ? organizationId : null);
  const patchOrg = usePatchPlatformOrganization();
  const deleteOrg = useDeletePlatformOrganization();

  const org = data ?? preview ?? null;
  const status = org?.status ?? "ACTIVE";

  function handleDelete() {
    if (!org) return;
    if (!confirm(`Delete organization "${org.name}"? This cannot be undone.`)) return;
    deleteOrg.mutate(org.id, {
      onSuccess: () => onOpenChange(false),
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 shrink-0 text-violet-400" />
            <span className="truncate">{org?.name ?? "Organization"}</span>
          </SheetTitle>
          <SheetDescription>
            Tenant details and management actions for this organization.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto py-6">
          {isLoading && !org ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : isError && !org ? (
            <p className="text-destructive text-sm">Failed to load organization.</p>
          ) : org ? (
            <>
              <div className="space-y-3">
                <DetailRow label="Slug">
                  <span className="font-mono text-sm">{org.slug}</span>
                </DetailRow>
                <DetailRow label="Status">
                  <Badge variant={statusVariant[status] ?? "secondary"}>{status}</Badge>
                </DetailRow>
                <DetailRow label="Users">
                  <span className="tabular-nums">{org.userCount}</span>
                </DetailRow>
                <DetailRow label="Courses">
                  <span className="tabular-nums">{org.courseCount}</span>
                </DetailRow>
                <DetailRow label="Created">
                  {org.createdAt ? formatDate(org.createdAt) : "—"}
                </DetailRow>
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="default" size="sm" asChild>
                  <Link href={`/platform/organizations/${org.id}/users`}>
                    <Users className="mr-2 h-3.5 w-3.5" />
                    Manage users
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(org)}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </Button>
                {status === "SUSPENDED" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={patchOrg.isPending}
                    onClick={() => patchOrg.mutate({ id: org.id, status: "ACTIVE" })}
                  >
                    {patchOrg.isPending ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Activate
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={patchOrg.isPending}
                    onClick={() => patchOrg.mutate({ id: org.id, status: "SUSPENDED" })}
                  >
                    {patchOrg.isPending ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Suspend
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </div>

        {org ? (
          <SheetFooter className="border-t border-border pt-4 sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteOrg.isPending}
              onClick={handleDelete}
            >
              {deleteOrg.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Delete
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <div className="min-w-0 text-right">{children}</div>
    </div>
  );
}
