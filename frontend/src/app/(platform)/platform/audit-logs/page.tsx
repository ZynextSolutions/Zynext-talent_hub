"use client";

import { PageHeader } from "@/components/layout/page-header";
import { usePlatformAuditLogs } from "@/hooks/usePlatform";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PlatformAuditLogsPage() {
  const { data, isLoading } = usePlatformAuditLogs({ page: 1 });

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Audit logs"
        description="Platform-wide activity across all tenants."
      />
      <div className="flex-1 px-6 py-6">
        <div className="rounded-xl border border-border bg-card shadow-luxury">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead className="hidden md:table-cell">Resource</TableHead>
                <TableHead className="hidden lg:table-cell">Org ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
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
                    <TableCell className="text-muted-foreground hidden lg:table-cell font-mono text-xs">
                      {log.organizationId?.slice(0, 8) ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                    No audit logs yet.
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
