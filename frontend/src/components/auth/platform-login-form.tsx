"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { ApiClientError } from "@/lib/api-client";

export function PlatformLoginForm() {
  const { platformLogin, verifyMfaLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await platformLogin(email, password);
      if (result.mfaRequired && result.mfaToken) {
        setMfaToken(result.mfaToken);
        toast.message("Enter your authenticator code to continue");
        return;
      }
      toast.success("Welcome, platform admin");
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Unable to sign in. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setIsSubmitting(true);
    try {
      await verifyMfaLogin(mfaToken, mfaCode.trim());
      toast.success("Welcome, platform admin");
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Invalid verification code. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (mfaToken) {
    return (
      <form onSubmit={handleMfaSubmit} className="space-y-4">
        <div className="space-y-1 text-center">
          <div className="bg-violet-600/10 text-violet-700 mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold">Two-factor authentication</h2>
          <p className="text-muted-foreground text-sm">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mfaCode">Verification code</Label>
          <Input
            id="mfaCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            required
            maxLength={8}
          />
        </div>
        <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Verifying…
            </>
          ) : (
            "Verify and continue"
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            setMfaToken(null);
            setMfaCode("");
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Platform admin email</Label>
        <Input
          id="email"
          type="email"
          placeholder="admin@platform.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in to platform"
        )}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Organization user?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Sign in to your org
        </Link>
      </p>
    </form>
  );
}
