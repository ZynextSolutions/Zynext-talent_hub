"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiClientError } from "@/lib/api-client";

const SCORM_MAX_BYTES = 100 * 1024 * 1024;

export function ScormUploadField({
  disabled,
  uploading,
  packageUrl,
  scormVersion,
  onUpload,
}: {
  disabled?: boolean;
  uploading?: boolean;
  packageUrl?: string | null;
  scormVersion?: string | null;
  onUpload: (file: File) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("Upload a SCORM package as a .zip file.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > SCORM_MAX_BYTES) {
      toast.error("SCORM package must be smaller than 100 MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      await onUpload(file);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "SCORM upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const pending = uploading || busy;

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="space-y-1">
        <Label>SCORM package</Label>
        <p className="text-muted-foreground text-xs">
          Upload a SCORM 1.2 ZIP with imsmanifest.xml. Publishing is allowed with a SCORM package and no native lessons.
        </p>
      </div>
      {packageUrl ? (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
          <p className="font-medium">Package installed</p>
          <p className="text-muted-foreground text-xs">
            SCORM {scormVersion ?? "1.2"} · {packageUrl.split("/").pop()}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No SCORM package uploaded yet.</p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending ? <Loader2 className="animate-spin" /> : <FileUp />}
        {packageUrl ? "Replace SCORM package" : "Upload SCORM package"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => void handleChange(e.target.files?.[0])}
      />
    </div>
  );
}
