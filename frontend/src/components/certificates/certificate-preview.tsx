"use client";

import { CertificateDocument, type CertificatePrintData } from "@/components/certificates/certificate-document";
import { cn } from "@/lib/utils";

const CERT_W = 1122;
const CERT_H = 792;

export function CertificatePreview({
  data,
  scale = 0.48,
  className,
}: {
  data: CertificatePrintData;
  scale?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-xl border border-border bg-muted/40 shadow-luxury", className)}
      style={{ width: CERT_W * scale, height: CERT_H * scale }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <CertificateDocument {...data} />
      </div>
    </div>
  );
}
