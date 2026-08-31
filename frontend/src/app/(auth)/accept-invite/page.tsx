"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { ApiClientError } from "@/lib/api-client";

function AcceptInviteForm() {
  const { acceptInvite } = useAuth();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error("Invalid invite link");
      return;
    }
    setIsSubmitting(true);
    try {
      await acceptInvite({ token, password, firstName, lastName });
      toast.success("Welcome to your organization");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to accept invite");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground text-sm">This invite link is invalid or expired.</p>
        <Button asChild variant="outline">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={12}
        />
        <p className="text-muted-foreground text-xs">Minimum 12 characters, with letters and a number</p>
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Activating…
          </>
        ) : (
          "Activate account"
        )}
      </Button>
    </form>
  );
}

export default function AcceptInvitePage() {
  return (
    <AuthLayout
      title="Accept your invite"
      subtitle="Set your name and password to join your organization"
    >
      <Suspense fallback={<Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo" />}>
        <AcceptInviteForm />
      </Suspense>
    </AuthLayout>
  );
}
