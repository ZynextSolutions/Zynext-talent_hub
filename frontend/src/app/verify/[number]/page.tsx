"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Award, CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { CertificateDocument } from "@/components/certificates/certificate-document";
import { useVerifyCertificate } from "@/hooks/useCertificates";
import { downloadElementAsPng } from "@/lib/download-certificate";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = use(params);
  const decoded = decodeURIComponent(number);
  const { data, isLoading, isError } = useVerifyCertificate(decoded);
  const artRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!downloading) return;
    const node = artRef.current?.querySelector<HTMLElement>("[data-certificate]");
    if (!node) {
      setDownloading(false);
      toast.error("Failed to download certificate");
      return;
    }
    let cancelled = false;
    void downloadElementAsPng(node, decoded)
      .then(() => {
        if (!cancelled) toast.success("Certificate downloaded");
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to download certificate");
      })
      .finally(() => {
        if (!cancelled) setDownloading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [downloading, decoded]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md shadow-luxury">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo/15">
            <Award className="h-6 w-6 text-indigo" />
          </div>
          <CardTitle>Certificate verification</CardTitle>
          <p className="text-muted-foreground font-mono text-sm">{decoded}</p>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {isLoading ? (
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo" />
          ) : isError || !data?.valid ? (
            <>
              <XCircle className="mx-auto h-10 w-10 text-destructive" />
              <Badge variant="destructive">Invalid or revoked</Badge>
              <p className="text-muted-foreground text-sm">
                {data?.reason ?? "This certificate could not be verified."}
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <Badge variant="default">Valid certificate</Badge>
              <dl className="space-y-2 text-left text-sm">
                {data.holderName && (
                  <div>
                    <dt className="text-muted-foreground">Issued to</dt>
                    <dd className="font-medium">{data.holderName}</dd>
                  </div>
                )}
                {data.courseTitle && (
                  <div>
                    <dt className="text-muted-foreground">
                      {data.kind === "path" ? "Learning path" : "Course"}
                    </dt>
                    <dd className="font-medium">{data.pathTitle ?? data.courseTitle}</dd>
                  </div>
                )}
                {data.organizationName && (
                  <div>
                    <dt className="text-muted-foreground">Organization</dt>
                    <dd className="font-medium">{data.organizationName}</dd>
                  </div>
                )}
                {data.issuedAt && (
                  <div>
                    <dt className="text-muted-foreground">Issued</dt>
                    <dd className="font-medium">{formatDate(data.issuedAt)}</dd>
                  </div>
                )}
              </dl>
            </>
          )}
          {data?.valid && (
            <Button
              className="w-full"
              disabled={downloading}
              onClick={() => setDownloading(true)}
            >
              <Download className="mr-2 h-4 w-4" />
              {downloading ? "Preparing…" : "Download certificate"}
            </Button>
          )}
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        </CardContent>
      </Card>
      {data?.valid && downloading && (
        <div ref={artRef} aria-hidden className="pointer-events-none fixed left-[-200vw] top-0">
          <CertificateDocument
            certificateNumber={decoded}
            holderName={data.holderName ?? "Learner"}
            courseTitle={data.courseTitle ?? "Course"}
            organizationName={data.organizationName ?? "Organization"}
            issuedAt={data.issuedAt ?? new Date().toISOString()}
            template={data.template}
          />
        </div>
      )}
    </div>
  );
}
