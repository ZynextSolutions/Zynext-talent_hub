"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { API_URL, ApiClientError, api } from "@/lib/api-client";

function RegisterLink() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api
      .get<{ allowed: boolean }>("/auth/registration-status", { auth: false })
      .then((data) => {
        if (!cancelled) setAllowed(data.allowed);
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (allowed !== true) return <span>Ask your administrator for an invite.</span>;
  return (
    <Link href="/register" className="text-primary font-medium hover:underline">
      Create account
    </Link>
  );
}

export function LoginForm() {
  const { login, verifyMfaLogin, completeSsoExchange } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState(searchParams.get("organizationSlug") ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const ssoExchangeConsumed = useRef<string | null>(null);

  useEffect(() => {
    const exchange = searchParams.get("ssoExchange");
    const ssoError = searchParams.get("ssoError");
    if (ssoError) {
      toast.error(`SSO sign-in failed (${ssoError.replace(/_/g, " ")})`);
      return;
    }
    if (!exchange || ssoExchangeConsumed.current === exchange) return;
    ssoExchangeConsumed.current = exchange;
    let cancelled = false;
    void (async () => {
      try {
        const result = await completeSsoExchange(exchange);
        if (cancelled) return;
        if (result.mfaRequired && result.mfaToken) {
          setMfaToken(result.mfaToken);
          toast.message("Enter your authenticator code to continue");
          return;
        }
        toast.success("Signed in with SSO");
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof ApiClientError ? err.message : "SSO sign-in failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [completeSsoExchange, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await login(email, password, organizationSlug);
      if (result.mfaRequired && result.mfaToken) {
        setMfaToken(result.mfaToken);
        toast.message("Enter your authenticator code to continue");
        return;
      }
      toast.success("Welcome back");
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
      toast.success("Welcome back");
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Invalid verification code. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSso() {
    const slug = organizationSlug.trim();
    if (!slug) {
      toast.error("Enter your organization slug first");
      return;
    }
    window.location.href = `${API_URL}/auth/sso/${encodeURIComponent(slug)}`;
  }

  const forgotHref = (() => {
    const params = new URLSearchParams();
    if (email) params.set("email", email);
    if (organizationSlug) params.set("organizationSlug", organizationSlug);
    const qs = params.toString();
    return qs ? `/forgot-password?${qs}` : "/forgot-password";
  })();

  if (mfaToken) {
    return (
      <form onSubmit={handleMfaSubmit} className="space-y-4">
        <div className="space-y-1 text-center">
          <div className="bg-primary/10 text-primary mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full">
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
        <Button type="submit" className="w-full" disabled={isSubmitting || mfaCode.trim().length < 6}>
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Verifying…
            </>
          ) : (
            "Verify and sign in"
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
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to sign in
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="organizationSlug">Organization slug</Label>
        <Input
          id="organizationSlug"
          placeholder="your-org"
          value={organizationSlug}
          onChange={(e) => setOrganizationSlug(e.target.value)}
          required
          autoComplete="organization"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href={forgotHref} className="text-primary text-xs font-medium hover:underline">
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
      {organizationSlug.trim() ? (
        <>
          <div className="relative">
            <Separator />
            <span className="bg-background text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 text-xs">
              or
            </span>
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={handleSso}>
            Continue with SSO
          </Button>
        </>
      ) : null}
      <p className="text-muted-foreground text-center text-sm">
        New organization?{" "}
        <RegisterLink />
      </p>
      <p className="text-muted-foreground text-center text-sm">
        Platform admin?{" "}
        <Link href="/platform/login" className="font-medium text-violet-400 hover:underline">
          Sign in here
        </Link>
      </p>
    </form>
  );
}
