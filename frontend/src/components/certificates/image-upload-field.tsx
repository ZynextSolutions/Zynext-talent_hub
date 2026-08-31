"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fileToCompressedDataUrl } from "@/lib/image-data-url";
import { resolveAssetUrl } from "@/lib/certificate-template";
import { ApiClientError } from "@/lib/api-client";

export function ImageUploadField({
  label,
  hint,
  value,
  disabled,
  uploading,
  onUpload,
  onClear,
}: {
  label: string;
  hint: string;
  value: string;
  disabled?: boolean;
  uploading?: boolean;
  onUpload: (file: File) => Promise<void>;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const preview = resolveAssetUrl(value);

  async function handleChange(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await onUpload(file);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="bg-muted flex h-14 w-20 items-center justify-center overflow-hidden rounded-md border border-border">
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="text-muted-foreground h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || busy || uploading}
              onClick={() => inputRef.current?.click()}
            >
              {busy || uploading ? <Loader2 className="animate-spin" /> : null}
              {preview ? "Replace" : "Upload"}
            </Button>
            {preview ? (
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onClear}>
                <Trash2 />
                Remove
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={disabled}
          onChange={(e) => void handleChange(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

export { fileToCompressedDataUrl };
