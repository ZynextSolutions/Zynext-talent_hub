"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { ApiClientError } from "@/lib/api-client";
import { slugify } from "@/lib/utils";

export function RegisterForm() {
  const { register } = useAuth();
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleOrgNameChange(value: string) {
    setOrganizationName(value);
    if (!slugTouched) {
      setOrganizationSlug(slugify(value));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await register({
        organizationName,
        organizationSlug,
        admin: { email, password, firstName, lastName },
      });
      toast.success("Organization created");
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Registration failed. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="organizationName">Organization name</Label>
        <Input
          id="organizationName"
          placeholder="Acme Corp"
          value={organizationName}
          onChange={(e) => handleOrgNameChange(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="organizationSlug">Organization slug</Label>
        <Input
          id="organizationSlug"
          placeholder="acme-corp"
          value={organizationSlug}
          onChange={(e) => {
            setSlugTouched(true);
            setOrganizationSlug(e.target.value);
          }}
          required
          pattern="^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$"
        />
      </div>
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
        <Label htmlFor="email">Admin email</Label>
        <Input
          id="email"
          type="email"
          placeholder="admin@acme.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
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
          minLength={12}
        />
        <p className="text-muted-foreground text-xs">Minimum 12 characters</p>
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Creating…
          </>
        ) : (
          "Create organization"
        )}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
