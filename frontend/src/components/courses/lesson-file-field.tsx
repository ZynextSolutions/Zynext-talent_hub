"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError } from "@/lib/api-client";

const VIDEO_MAX_BYTES = 80 * 1024 * 1024;
const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

export function LessonFileField({
  kind,
  label,
  hint,
  value,
  disabled,
  urlPlaceholder,
  onUrlChange,
  onUpload,
  onClear,
}: {
  kind: "video" | "document";
  label: string;
  hint: string;
  value: string;
  disabled?: boolean;
  urlPlaceholder: string;
  onUrlChange: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const uploaded = value.startsWith("/uploads/");
  const maxBytes = kind === "video" ? VIDEO_MAX_BYTES : DOCUMENT_MAX_BYTES;

  async function handleChange(file: File | undefined) {
    if (!file) return;
    if (file.size > maxBytes) {
      toast.error(`File must be smaller than ${Math.round(maxBytes / (1024 * 1024))} MB.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
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
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <FileUp />}
          {uploaded ? "Replace file" : "Upload file"}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" disabled={disabled || busy} onClick={onClear}>
            <Trash2 />
            Remove
          </Button>
        ) : null}
      </div>
      {uploaded ? (
        <p className="text-muted-foreground truncate text-xs">{value.split("/").pop()}</p>
      ) : (
        <Input
          type="text"
          inputMode="url"
          value={value}
          disabled={disabled}
          placeholder={urlPlaceholder}
          onChange={(e) => onUrlChange(e.target.value)}
        />
      )}
      <p className="text-muted-foreground text-xs">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={
          kind === "video"
            ? "video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
            : ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt,application/pdf"
        }
        className="hidden"
        disabled={disabled}
        onChange={(e) => void handleChange(e.target.files?.[0])}
      />
    </div>
  );
}
