import type {
  CertificateAlign,
  CertificateFontFamily,
  CertificateFontStyle,
  CertificateFontWeight,
  CertificateTemplate,
  CertificateTheme,
  OrgSettings,
} from "@/types";

export const DEFAULT_CERTIFICATE_TEMPLATE: CertificateTemplate = {
  theme: "midnight",
  title: "Certificate of Completion",
  eyebrow: "This certifies that",
  body: "has successfully completed",
  organizationName: "",
  accentColor: "#818cf8",
  signatoryName: "",
  signatoryTitle: "",
  footerNote: "",
  logoUrl: "",
  signatureUrl: "",
  backgroundUrl: "",
  textAlign: "center",
  fontFamily: "serif",
  fontWeight: "semibold",
  fontStyle: "normal",
  orgNameSize: 12,
  titleSize: 36,
  nameSize: 36,
  bodySize: 14,
  courseSize: 24,
};

export const CERTIFICATE_THEMES: Array<{
  id: CertificateTheme;
  label: string;
  description: string;
  swatch: string;
}> = [
  { id: "midnight", label: "Midnight", description: "Dark luxury", swatch: "#0b1020" },
  { id: "ivory", label: "Ivory", description: "Classic parchment", swatch: "#f6f0e4" },
  { id: "slate", label: "Slate", description: "Clean corporate", swatch: "#f1f5f9" },
];

export const THEME_PALETTE: Record<
  CertificateTheme,
  { background: string; text: string; muted: string; faded: string; defaultAccent: string }
> = {
  midnight: {
    background: "#0b1020",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.68)",
    faded: "rgba(255,255,255,0.45)",
    defaultAccent: "#818cf8",
  },
  ivory: {
    background: "#f6f0e4",
    text: "#1c1917",
    muted: "rgba(28,25,23,0.62)",
    faded: "rgba(28,25,23,0.42)",
    defaultAccent: "#b45309",
  },
  slate: {
    background: "#f1f5f9",
    text: "#0f172a",
    muted: "rgba(15,23,42,0.62)",
    faded: "rgba(15,23,42,0.4)",
    defaultAccent: "#334155",
  },
};

export const FONT_STACKS: Record<CertificateFontFamily, string> = {
  serif: "Georgia, 'Times New Roman', Times, serif",
  sans: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  display: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
  script: "'Segoe Script', 'Snell Roundhand', 'Brush Script MT', cursive",
};

export const FONT_WEIGHTS: Record<CertificateFontWeight, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

const HEX = /^#([0-9A-Fa-f]{6})$/;
const THEMES = new Set<CertificateTheme>(["midnight", "ivory", "slate"]);
const ALIGNS = new Set<CertificateAlign>(["left", "center", "right"]);
const FONTS = new Set<CertificateFontFamily>(["serif", "sans", "display", "script"]);
const WEIGHTS = new Set<CertificateFontWeight>(["normal", "medium", "semibold", "bold"]);
const STYLES = new Set<CertificateFontStyle>(["normal", "italic"]);

function asEnum<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : fallback;
}

function asSize(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function parseCertificateTemplate(raw: unknown): CertificateTemplate {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const theme = THEMES.has(obj.theme as CertificateTheme)
    ? (obj.theme as CertificateTheme)
    : DEFAULT_CERTIFICATE_TEMPLATE.theme;
  return {
    theme,
    title:
      typeof obj.title === "string" && obj.title.trim()
        ? obj.title.trim().slice(0, 80)
        : DEFAULT_CERTIFICATE_TEMPLATE.title,
    eyebrow: typeof obj.eyebrow === "string" ? obj.eyebrow.trim().slice(0, 80) : DEFAULT_CERTIFICATE_TEMPLATE.eyebrow,
    body: typeof obj.body === "string" ? obj.body.trim().slice(0, 120) : DEFAULT_CERTIFICATE_TEMPLATE.body,
    organizationName: typeof obj.organizationName === "string" ? obj.organizationName.trim().slice(0, 120) : "",
    accentColor:
      typeof obj.accentColor === "string" && HEX.test(obj.accentColor)
        ? obj.accentColor
        : DEFAULT_CERTIFICATE_TEMPLATE.accentColor,
    signatoryName: typeof obj.signatoryName === "string" ? obj.signatoryName.trim().slice(0, 80) : "",
    signatoryTitle: typeof obj.signatoryTitle === "string" ? obj.signatoryTitle.trim().slice(0, 80) : "",
    footerNote: typeof obj.footerNote === "string" ? obj.footerNote.trim().slice(0, 160) : "",
    logoUrl: asAssetUrl(obj.logoUrl),
    signatureUrl: asAssetUrl(obj.signatureUrl),
    backgroundUrl: asAssetUrl(obj.backgroundUrl),
    textAlign: asEnum(obj.textAlign, ALIGNS, DEFAULT_CERTIFICATE_TEMPLATE.textAlign),
    fontFamily: asEnum(obj.fontFamily, FONTS, DEFAULT_CERTIFICATE_TEMPLATE.fontFamily),
    fontWeight: asEnum(obj.fontWeight, WEIGHTS, DEFAULT_CERTIFICATE_TEMPLATE.fontWeight),
    fontStyle: asEnum(obj.fontStyle, STYLES, DEFAULT_CERTIFICATE_TEMPLATE.fontStyle),
    orgNameSize: asSize(obj.orgNameSize, 10, 22, DEFAULT_CERTIFICATE_TEMPLATE.orgNameSize),
    titleSize: asSize(obj.titleSize, 22, 56, DEFAULT_CERTIFICATE_TEMPLATE.titleSize),
    nameSize: asSize(obj.nameSize, 22, 56, DEFAULT_CERTIFICATE_TEMPLATE.nameSize),
    bodySize: asSize(obj.bodySize, 11, 22, DEFAULT_CERTIFICATE_TEMPLATE.bodySize),
    courseSize: asSize(obj.courseSize, 14, 40, DEFAULT_CERTIFICATE_TEMPLATE.courseSize),
  };
}

function asAssetUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const url = value.trim();
  if (!url) return "";
  if (url.startsWith("/uploads/") || url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:image/")) {
    return url;
  }
  return "";
}

import { resolveApiOrigin } from "./api-client";

export function resolveAssetUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) {
    if (typeof window !== "undefined" && /https?:\/\/localhost(?::4000)?/.test(url)) {
      return url.replace(/^https?:\/\/localhost(?::4000)?/, resolveApiOrigin());
    }
    return url;
  }
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  const origin = typeof window !== "undefined" ? resolveApiOrigin() : apiBase.replace(/\/api\/v1\/?$/, "");
  if (url.startsWith("/uploads/")) {
    return `${origin}/api/v1/media${url}`;
  }
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
}

export function templateFromOrgSettings(settings?: OrgSettings | null): CertificateTemplate {
  return parseCertificateTemplate(settings?.certificateTemplate);
}

export function certificatePrefixFromSettings(settings?: OrgSettings | null): string {
  const prefix = settings?.certificatePrefix;
  return typeof prefix === "string" && prefix.trim().length >= 2 ? prefix.trim().slice(0, 12) : "COR";
}
