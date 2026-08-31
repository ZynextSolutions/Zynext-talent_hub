"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { RegisterForm } from "@/components/auth/register-form";
import { api } from "@/lib/api-client";

export default function RegisterPage() {
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

  if (allowed === false) {
    return (
      <AuthLayout title="Registration closed" subtitle="New organizations must be provisioned by a platform administrator.">
        <p className="text-muted-foreground text-sm">
          <Link href="/login" className="text-primary font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your organization"
      subtitle="Set up your workspace and admin account in minutes"
    >
      {allowed === null ? <p className="text-muted-foreground text-sm">Checking availability…</p> : <RegisterForm />}
    </AuthLayout>
  );
}
