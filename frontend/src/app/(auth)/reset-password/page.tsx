"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiClientError } from "@/lib/api-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error("Invalid reset link");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword: password }, { auth: false });
      toast.success("Password updated — you can sign in now");
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to reset password");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground text-sm">This reset link is invalid or expired.</p>
        <Button asChild variant="outline">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={12}
        />
        <p className="text-muted-foreground text-xs">Minimum 12 characters</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={12}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Updating…
          </>
        ) : (
          "Update password"
        )}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Choose a new password" subtitle="Enter your new password below">
      <Suspense fallback={<Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
