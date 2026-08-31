"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { useAuditLogs } from "@/hooks/usePhase3";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AuditLogsPage() {
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLogs({ page }, hasPermission("audit:read"));

  if (!hasPermission("audit:read")) {
    return (
      <div className="flex flex-1 flex-col overflow-auto">
        <PageHeader title="Audit logs" description="You do not have permission to view audit logs." />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader title="Audit logs" description="Tenant activity and administrative actions." />
      <div className="flex-1 px-6 py-6">
        <div className="rounded-xl border border-border bg-card shadow-luxury">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead className="hidden md:table-cell">Resource</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : data?.items?.length ? (
                data.items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="text-muted-foreground">{log.actorType}</span>
                      <span className="ml-1 font-mono text-xs">{log.actorId.slice(0, 8)}…</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell text-sm">
                      {log.resourceType ?? "—"}
                      {log.resourceId ? ` · ${log.resourceId.slice(0, 8)}…` : ""}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                    No audit logs yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {(data?.pagination?.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
              <p className="text-muted-foreground text-sm">
                Page {data?.pagination?.page ?? 1} of {data?.pagination?.totalPages ?? 1}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= (data?.pagination?.totalPages ?? 1)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
