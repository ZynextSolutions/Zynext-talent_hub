"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your organization workspace">
      <Suspense fallback={<Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo" />}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
