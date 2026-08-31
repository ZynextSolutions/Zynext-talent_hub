"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { CertificatePreview } from "@/components/certificates/certificate-preview";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUploadField } from "@/components/certificates/image-upload-field";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization, useUpdateOrganization, useUploadCertificateAsset } from "@/hooks/useOrganization";
import { ApiClientError } from "@/lib/api-client";
import { fileToCompressedDataUrl } from "@/lib/image-data-url";
import {
  CERTIFICATE_THEMES,
  DEFAULT_CERTIFICATE_TEMPLATE,
  certificatePrefixFromSettings,
  parseCertificateTemplate,
} from "@/lib/certificate-template";
import { cn } from "@/lib/utils";
import type { CertificateTemplate } from "@/types";

export default function CertificateTemplatePage() {
  const { user, organization, hasPermission } = useAuth();
  const { data: org } = useOrganization();
  const updateOrganization = useUpdateOrganization();
  const uploadAsset = useUploadCertificateAsset();
  const canEdit = hasPermission("org:write");
  const [uploadingKind, setUploadingKind] = useState<"logo" | "signature" | "background" | null>(null);

  const [prefix, setPrefix] = useState("COR");
  const [template, setTemplate] = useState<CertificateTemplate>(DEFAULT_CERTIFICATE_TEMPLATE);

  const saved = org ?? organization;

  useEffect(() => {
    if (!saved) return;
    setPrefix(certificatePrefixFromSettings(saved.settings));
    setTemplate(parseCertificateTemplate(saved.settings?.certificateTemplate));
  }, [saved]);

  const sample = useMemo(
    () => ({
      certificateNumber: `${prefix || "COR"}-${new Date().getUTCFullYear()}-PREVIEW1`,
      holderName: user ? `${user.firstName} ${user.lastName}`.trim() : "Alex Morgan",
      courseTitle: "Security Awareness Training",
      organizationName:
        template.organizationName.trim() || saved?.name || organization?.name || "Organization",
      issuedAt: new Date().toISOString(),
      verificationUrl: `/verify/${prefix || "COR"}-${new Date().getUTCFullYear()}-PREVIEW1`,
      template,
    }),
    [prefix, template, user, saved?.name, organization?.name],
  );

  function patchTemplate<K extends keyof CertificateTemplate>(key: K, value: CertificateTemplate[K]) {
    setTemplate((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    const nextPrefix = prefix.trim().toUpperCase();
    if (nextPrefix.length < 2 || nextPrefix.length > 12) {
      toast.error("Certificate prefix must be 2–12 characters");
      return;
    }
    try {
      await updateOrganization.mutateAsync({
        settings: {
          certificatePrefix: nextPrefix,
          certificateTemplate: parseCertificateTemplate(template),
        },
      });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to save template");
    }
  }

  async function handleAssetUpload(kind: "logo" | "signature" | "background", file: File) {
    const maxEdge = kind === "background" ? 1400 : kind === "signature" ? 480 : 320;
    const dataUrl = await fileToCompressedDataUrl(file, { maxEdge, quality: kind === "background" ? 0.76 : 0.84 });
    setUploadingKind(kind);
    try {
      const result = await uploadAsset.mutateAsync({ kind, dataUrl });
      patchTemplate(`${kind}Url`, result.path || result.url);
    } finally {
      setUploadingKind(null);
    }
  }

  function handleReset() {
    setTemplate(DEFAULT_CERTIFICATE_TEMPLATE);
    setPrefix("COR");
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Certificate template"
        description="Preview and customize how issued certificates look for your organization."
        actions={
          <Button asChild variant="outline">
            <Link href="/certificates">
              <ArrowLeft />
              Back to certificates
            </Link>
          </Button>
        }
      />
      <div className="flex-1 px-6 py-6">
        <form onSubmit={handleSave} className="grid gap-8 xl:grid-cols-[minmax(0,22rem)_1fr]">
          <div className="space-y-6">
            <fieldset className="space-y-3" disabled={!canEdit}>
              <legend className="text-sm font-medium">Theme</legend>
              <div className="grid grid-cols-3 gap-2">
                {CERTIFICATE_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => patchTemplate("theme", theme.id)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-left transition-colors",
                      template.theme === theme.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <span
                      className="mb-2 block h-8 rounded-md border border-border"
                      style={{ background: theme.swatch }}
                    />
                    <span className="block text-xs font-medium">{theme.label}</span>
                    <span className="text-muted-foreground block text-[11px]">{theme.description}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <ImageUploadField
              label="Background image"
              hint="Optional full-page background. Theme color tints the image so text stays readable."
              value={template.backgroundUrl}
              disabled={!canEdit}
              uploading={uploadingKind === "background"}
              onUpload={(file) => handleAssetUpload("background", file)}
              onClear={() => patchTemplate("backgroundUrl", "")}
            />
            <ImageUploadField
              label="Organization logo"
              hint="PNG or JPEG. Shown at the top of the certificate."
              value={template.logoUrl}
              disabled={!canEdit}
              uploading={uploadingKind === "logo"}
              onUpload={(file) => handleAssetUpload("logo", file)}
              onClear={() => patchTemplate("logoUrl", "")}
            />
            <ImageUploadField
              label="Signature"
              hint="Transparent PNG works best. Shown above the signatory name."
              value={template.signatureUrl}
              disabled={!canEdit}
              uploading={uploadingKind === "signature"}
              onUpload={(file) => handleAssetUpload("signature", file)}
              onClear={() => patchTemplate("signatureUrl", "")}
            />

            <div className="space-y-2">
              <Label htmlFor="accentColor">Accent color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="accentColor"
                  type="color"
                  className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent p-1"
                  value={template.accentColor}
                  disabled={!canEdit}
                  onChange={(e) => patchTemplate("accentColor", e.target.value)}
                />
                <Input
                  value={template.accentColor}
                  disabled={!canEdit}
                  onChange={(e) => patchTemplate("accentColor", e.target.value)}
                  maxLength={7}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgDisplayName">Organization name on certificate</Label>
              <Input
                id="orgDisplayName"
                value={template.organizationName}
                disabled={!canEdit}
                maxLength={120}
                placeholder={saved?.name ?? organization?.name ?? "Uses the organization name"}
                onChange={(e) => patchTemplate("organizationName", e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Leave blank to use {saved?.name ?? "the organization name"}.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="certTitle">Title</Label>
              <Input
                id="certTitle"
                value={template.title}
                disabled={!canEdit}
                maxLength={80}
                onChange={(e) => patchTemplate("title", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eyebrow">Intro line</Label>
              <Input
                id="eyebrow"
                value={template.eyebrow}
                disabled={!canEdit}
                maxLength={80}
                onChange={(e) => patchTemplate("eyebrow", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Completion line</Label>
              <Input
                id="body"
                value={template.body}
                disabled={!canEdit}
                maxLength={120}
                onChange={(e) => patchTemplate("body", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="signatoryName">Signatory name</Label>
                <Input
                  id="signatoryName"
                  value={template.signatoryName}
                  disabled={!canEdit}
                  maxLength={80}
                  placeholder="Optional"
                  onChange={(e) => patchTemplate("signatoryName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signatoryTitle">Signatory title</Label>
                <Input
                  id="signatoryTitle"
                  value={template.signatoryTitle}
                  disabled={!canEdit}
                  maxLength={80}
                  placeholder="Optional"
                  onChange={(e) => patchTemplate("signatoryTitle", e.target.value)}
                />
              </div>
            </div>
            <fieldset className="space-y-3" disabled={!canEdit}>
              <legend className="text-sm font-medium">Typography</legend>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Alignment</Label>
                  <Select
                    value={template.textAlign}
                    onValueChange={(value) =>
                      patchTemplate("textAlign", value as CertificateTemplate["textAlign"])
                    }
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Font family</Label>
                  <Select
                    value={template.fontFamily}
                    onValueChange={(value) =>
                      patchTemplate("fontFamily", value as CertificateTemplate["fontFamily"])
                    }
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serif">Serif (Georgia)</SelectItem>
                      <SelectItem value="sans">Sans (Inter)</SelectItem>
                      <SelectItem value="display">Display (Palatino)</SelectItem>
                      <SelectItem value="script">Script</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Font weight</Label>
                  <Select
                    value={template.fontWeight}
                    onValueChange={(value) =>
                      patchTemplate("fontWeight", value as CertificateTemplate["fontWeight"])
                    }
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Regular</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="semibold">Semibold</SelectItem>
                      <SelectItem value="bold">Bold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Font style</Label>
                  <Select
                    value={template.fontStyle}
                    onValueChange={(value) =>
                      patchTemplate("fontStyle", value as CertificateTemplate["fontStyle"])
                    }
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="italic">Italic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SizeField
                  id="orgNameSize"
                  label="Org name size"
                  value={template.orgNameSize}
                  min={10}
                  max={22}
                  disabled={!canEdit}
                  onChange={(value) => patchTemplate("orgNameSize", value)}
                />
                <SizeField
                  id="titleSize"
                  label="Title size"
                  value={template.titleSize}
                  min={22}
                  max={56}
                  disabled={!canEdit}
                  onChange={(value) => patchTemplate("titleSize", value)}
                />
                <SizeField
                  id="nameSize"
                  label="Learner name size"
                  value={template.nameSize}
                  min={22}
                  max={56}
                  disabled={!canEdit}
                  onChange={(value) => patchTemplate("nameSize", value)}
                />
                <SizeField
                  id="courseSize"
                  label="Course title size"
                  value={template.courseSize}
                  min={14}
                  max={40}
                  disabled={!canEdit}
                  onChange={(value) => patchTemplate("courseSize", value)}
                />
                <SizeField
                  id="bodySize"
                  label="Body text size"
                  value={template.bodySize}
                  min={11}
                  max={22}
                  disabled={!canEdit}
                  onChange={(value) => patchTemplate("bodySize", value)}
                />
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="footerNote">Footer note</Label>
              <textarea
                id="footerNote"
                className="border-input min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                value={template.footerNote}
                disabled={!canEdit}
                maxLength={160}
                placeholder="Optional legal or verification note"
                onChange={(e) => patchTemplate("footerNote", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prefix">Certificate number prefix</Label>
              <Input
                id="prefix"
                value={prefix}
                disabled={!canEdit}
                maxLength={12}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              />
              <p className="text-muted-foreground text-xs">
                New certificates will use numbers like {prefix || "COR"}-{new Date().getUTCFullYear()}
                -XXXXXXXX
              </p>
            </div>

            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={updateOrganization.isPending}>
                  {updateOrganization.isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save template"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={handleReset}>
                  <RotateCcw />
                  Reset defaults
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                You can preview the template. Organization admins can save changes.
              </p>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-muted-foreground mb-3 text-sm">Live preview with sample learner data</p>
            <div className="overflow-x-auto pb-2">
              <CertificatePreview data={sample} scale={0.52} />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function SizeField({
  id,
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} <span className="text-muted-foreground font-normal">({value}px)</span>
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) || min)}
      />
    </div>
  );
}
