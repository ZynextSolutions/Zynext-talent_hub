"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Award, Download, ExternalLink, Palette, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { CertificateDocument } from "@/components/certificates/certificate-document";
import { useAuth } from "@/hooks/useAuth";
import { useCertificates, useRevokeCertificate } from "@/hooks/useCertificates";
import { useOrganization } from "@/hooks/useOrganization";
import { templateFromOrgSettings } from "@/lib/certificate-template";
import { downloadElementAsPng } from "@/lib/download-certificate";
import { formatDate } from "@/lib/utils";
import type { Certificate } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function holderName(cert: Certificate) {
  if (cert.user) return `${cert.user.firstName} ${cert.user.lastName}`.trim();
  return "Learner";
}

export default function CertificatesPage() {
  const { hasPermission, organization } = useAuth();
  const { data: org } = useOrganization();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCertificates({ page, pageSize: 25 });
  const totalPages = data?.totalPages ?? 1;
  const revoke = useRevokeCertificate();
  const canRevoke = hasPermission("certificate:revoke");
  const canCustomize = hasPermission("org:write");
  const template = templateFromOrgSettings(org?.settings ?? organization?.settings);
  const artRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<Certificate | null>(null);

  function handleRevoke(id: string) {
    const reason = window.prompt("Reason for revocation:");
    if (!reason?.trim()) return;
    revoke.mutate({ id, reason: reason.trim() });
  }

  function handleDownload(cert: Certificate) {
    if (cert.revokedAt) {
      toast.error("Revoked certificates cannot be downloaded");
      return;
    }
    setExporting(cert);
  }

  useEffect(() => {
    if (!exporting) return;
    const node = artRef.current?.querySelector<HTMLElement>("[data-certificate]");
    if (!node) {
      setExporting(null);
      toast.error("Failed to download certificate");
      return;
    }
    let cancelled = false;
    void downloadElementAsPng(node, exporting.certificateNumber)
      .then(() => {
        if (!cancelled) toast.success("Certificate downloaded");
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to download certificate");
      })
      .finally(() => {
        if (!cancelled) setExporting(null);
      });
    return () => {
      cancelled = true;
    };
  }, [exporting]);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Certificates"
        description="View, verify, and download certificates issued to learners."
        actions={
          canCustomize ? (
            <Button asChild variant="outline">
              <Link href="/certificates/template">
                <Palette />
                Customize template
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="flex-1 px-6 py-4">
        <div className="rounded-xl border border-border bg-card shadow-luxury">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9">Certificate #</TableHead>
                <TableHead className="h-9">Learner</TableHead>
                <TableHead className="hidden h-9 lg:table-cell">Course / path</TableHead>
                <TableHead className="h-9">Issued</TableHead>
                <TableHead className="h-9">Status</TableHead>
                <TableHead className="h-9 w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : data?.items?.length ? (
                data.items.map((cert) => (
                  <TableRow key={cert.id}>
                    <TableCell className="max-w-[10rem] truncate py-2 font-mono text-xs">
                      {cert.certificateNumber}
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate py-2 text-sm">
                      {cert.user
                        ? `${cert.user.firstName} ${cert.user.lastName}`
                        : cert.userId.slice(0, 8)}
                    </TableCell>
                    <TableCell className="hidden max-w-[14rem] truncate py-2 text-sm lg:table-cell">
                      {cert.path?.title ?? cert.course?.title ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground py-2 text-xs">
                      {formatDate(cert.issuedAt)}
                    </TableCell>
                    <TableCell className="py-2">
                      {cert.revokedAt ? (
                        <Badge variant="destructive">Revoked</Badge>
                      ) : (
                        <Badge variant="default">Valid</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <Link
                            href={`/verify/${cert.certificateNumber}`}
                            target="_blank"
                            title="Verify"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Download certificate"
                          disabled={!!cert.revokedAt || exporting?.id === cert.id}
                          onClick={() => handleDownload(cert)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {canRevoke && !cert.revokedAt && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleRevoke(cert.id)}
                            disabled={revoke.isPending}
                            title="Revoke"
                          >
                            <ShieldOff className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-sm">
                      <Award className="mb-3 h-10 w-10 opacity-40" />
                      No certificates issued yet.
                    </div>
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

      <div
        ref={artRef}
        aria-hidden
        className="pointer-events-none fixed left-[-200vw] top-0"
      >
        {exporting && (
          <CertificateDocument
            certificateNumber={exporting.certificateNumber}
            holderName={holderName(exporting)}
            courseTitle={exporting.path?.title ?? exporting.course?.title ?? "Certificate"}
            organizationName={
              exporting.organization?.name ?? organization?.name ?? "Organization"
            }
            issuedAt={exporting.issuedAt}
            verificationUrl={exporting.verificationUrl}
            template={template}
          />
        )}
      </div>
    </div>
  );
}
