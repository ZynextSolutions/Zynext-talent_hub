"use client";

import { Award } from "lucide-react";
import {
  DEFAULT_CERTIFICATE_TEMPLATE,
  FONT_STACKS,
  FONT_WEIGHTS,
  THEME_PALETTE,
  parseCertificateTemplate,
  resolveAssetUrl,
} from "@/lib/certificate-template";
import { formatDate } from "@/lib/utils";
import type { CertificateTemplate } from "@/types";

export type CertificatePrintData = {
  certificateNumber: string;
  holderName: string;
  courseTitle: string;
  organizationName: string;
  issuedAt: string;
  verificationUrl?: string;
  template?: CertificateTemplate | null;
};

const ALIGN_ITEMS = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
} as const;

export function CertificateDocument({
  certificateNumber,
  holderName,
  courseTitle,
  organizationName,
  issuedAt,
  verificationUrl,
  template,
}: CertificatePrintData) {
  const resolved = parseCertificateTemplate(template ?? DEFAULT_CERTIFICATE_TEMPLATE);
  const palette = THEME_PALETTE[resolved.theme];
  const accent = resolved.accentColor || palette.defaultAccent;
  const logoSrc = resolveAssetUrl(resolved.logoUrl);
  const signatureSrc = resolveAssetUrl(resolved.signatureUrl);
  const backgroundSrc = resolveAssetUrl(resolved.backgroundUrl);
  const hasSignatory = Boolean(resolved.signatoryName || resolved.signatoryTitle || signatureSrc);
  const orgLabel = resolved.organizationName.trim() || organizationName;
  const align = resolved.textAlign;
  const typeStyle = {
    fontFamily: FONT_STACKS[resolved.fontFamily],
    fontWeight: FONT_WEIGHTS[resolved.fontWeight],
    fontStyle: resolved.fontStyle,
    textAlign: align,
  } as const;

  return (
    <div
      data-certificate
      className="relative h-[792px] w-[1122px] overflow-hidden p-10"
      style={{
        background: palette.background,
        color: palette.text,
        fontFamily: FONT_STACKS[resolved.fontFamily],
      }}
    >
      {backgroundSrc ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${backgroundSrc}")` }}
          />
          <div className="absolute inset-0" style={{ background: `${palette.background}b3` }} />
        </>
      ) : null}
      <div className="absolute inset-6 rounded-sm" style={{ border: `1px solid ${accent}66` }} />
      <div className="absolute inset-8 rounded-sm" style={{ border: `1px solid ${accent}40` }} />
      <div
        className="relative flex h-full flex-col justify-between px-16 py-10"
        style={{ alignItems: ALIGN_ITEMS[align], textAlign: align }}
      >
        <div className="w-full max-w-4xl space-y-3" style={typeStyle}>
          {logoSrc ? (
            <img
              src={logoSrc}
              alt=""
              crossOrigin="anonymous"
              className="h-16 max-w-[220px] object-contain"
              style={{
                marginLeft: align === "right" ? "auto" : align === "center" ? "auto" : 0,
                marginRight: align === "left" ? 0 : "auto",
              }}
            />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{
                background: `${accent}33`,
                boxShadow: `0 0 0 1px ${accent}66`,
                marginLeft: align === "right" ? "auto" : align === "center" ? "auto" : 0,
                marginRight: align === "left" ? 0 : "auto",
              }}
            >
              <Award className="h-8 w-8" style={{ color: accent }} />
            </div>
          )}
          <p
            className="uppercase tracking-[0.35em]"
            style={{ color: accent, fontSize: resolved.orgNameSize }}
          >
            {orgLabel}
          </p>
          <h1 className="tracking-wide" style={{ fontSize: resolved.titleSize, lineHeight: 1.15 }}>
            {resolved.title}
          </h1>
        </div>

        <div className="w-full max-w-3xl space-y-4" style={typeStyle}>
          <p className="uppercase tracking-[0.25em]" style={{ color: palette.muted, fontSize: resolved.bodySize }}>
            {resolved.eyebrow}
          </p>
          <p className="tracking-tight" style={{ fontSize: resolved.nameSize, lineHeight: 1.15 }}>
            {holderName}
          </p>
          <p style={{ color: palette.muted, fontSize: resolved.bodySize }}>{resolved.body}</p>
          <p style={{ color: accent, fontSize: resolved.courseSize, lineHeight: 1.2 }}>{courseTitle}</p>
        </div>

        <div className="w-full space-y-6" style={typeStyle}>
          {hasSignatory && (
            <div
              className="max-w-xs"
              style={{
                marginLeft: align === "right" ? "auto" : align === "center" ? "auto" : 0,
                marginRight: align === "left" ? 0 : "auto",
              }}
            >
              {signatureSrc ? (
                <img
                  src={signatureSrc}
                  alt=""
                  crossOrigin="anonymous"
                  className="mb-1 h-14 max-w-[220px] object-contain"
                  style={{
                    marginLeft: align === "right" ? "auto" : align === "center" ? "auto" : 0,
                    marginRight: align === "left" ? 0 : "auto",
                  }}
                />
              ) : null}
              <div
                className="mb-2 h-px w-40"
                style={{
                  background: `${accent}66`,
                  marginLeft: align === "right" ? "auto" : align === "center" ? "auto" : 0,
                  marginRight: align === "left" ? 0 : "auto",
                }}
              />
              {resolved.signatoryName && (
                <p style={{ fontSize: resolved.bodySize }}>{resolved.signatoryName}</p>
              )}
              {resolved.signatoryTitle && (
                <p style={{ color: palette.faded, fontSize: Math.max(11, resolved.bodySize - 2) }}>
                  {resolved.signatoryTitle}
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-6" style={{ color: palette.muted, fontSize: resolved.bodySize }}>
            <div style={{ textAlign: "left" }}>
              <p className="uppercase tracking-wider" style={{ color: palette.faded, fontSize: 11 }}>
                Issued
              </p>
              <p className="mt-1" style={{ color: palette.text }}>
                {formatDate(issuedAt)}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p className="uppercase tracking-wider" style={{ color: palette.faded, fontSize: 11 }}>
                Certificate number
              </p>
              <p className="mt-1 font-mono" style={{ color: palette.text }}>
                {certificateNumber}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p className="uppercase tracking-wider" style={{ color: palette.faded, fontSize: 11 }}>
                Verify
              </p>
              <p className="mt-1 truncate" style={{ color: accent, fontSize: 12 }}>
                {verificationUrl ?? `/verify/${certificateNumber}`}
              </p>
            </div>
          </div>
          {resolved.footerNote && (
            <p style={{ color: palette.faded, fontSize: Math.max(11, resolved.bodySize - 2) }}>
              {resolved.footerNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
