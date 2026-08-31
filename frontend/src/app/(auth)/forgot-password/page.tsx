"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiClientError } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email, organizationSlug }, { auth: false });
      setSent(true);
      toast.success("If an account exists, a reset link was sent");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Request failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Reset password"
      subtitle="We'll email you a link to choose a new password"
    >
      {sent ? (
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground text-sm">
            Check your inbox for a reset link. In development, the link is printed in the API
            server console.
          </p>
          <Button asChild variant="outline">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="organizationSlug">Organization slug</Label>
            <Input
              id="organizationSlug"
              value={organizationSlug}
              onChange={(e) => setOrganizationSlug(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" />
                Sending…
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            <Link href="/login" className="text-primary font-medium hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
