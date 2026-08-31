"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface ForumComposerProps {
  title?: string;
  onTitleChange?: (value: string) => void;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  showTitle?: boolean;
}

export function ForumComposer({
  title,
  onTitleChange,
  value,
  onChange,
  placeholder = "Share your thoughts…",
  rows = 5,
  disabled,
  showTitle,
}: ForumComposerProps) {
  return (
    <div className="space-y-3">
      {showTitle && onTitleChange ? (
        <div className="space-y-2">
          <Label htmlFor="forum-title">Title</Label>
          <Input
            id="forum-title"
            value={title ?? ""}
            onChange={(e) => onTitleChange(e.target.value)}
            disabled={disabled}
            maxLength={200}
            placeholder="Discussion topic"
          />
        </div>
      ) : null}
      <div className="space-y-2">
        {showTitle ? <Label htmlFor="forum-body">Message</Label> : null}
        <Textarea
          id="forum-body"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          maxLength={8000}
        />
      </div>
    </div>
  );
}
