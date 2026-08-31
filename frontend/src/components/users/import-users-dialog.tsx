"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useImportUsers } from "@/hooks/useUsers";

export function ImportUsersDialog() {
  const importUsers = useImportUsers();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    try {
      await importUsers.mutateAsync(file);
      setOpen(false);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      // toast handled in hook
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFile(null);
          if (inputRef.current) inputRef.current.value = "";
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Import users</DialogTitle>
            <DialogDescription>
              Upload a CSV file with columns: email, firstName, lastName, role, teamId.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="usersCsv">CSV file</Label>
            <Input
              id="usersCsv"
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!file || importUsers.isPending}>
              {importUsers.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Importing…
                </>
              ) : (
                "Import"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
