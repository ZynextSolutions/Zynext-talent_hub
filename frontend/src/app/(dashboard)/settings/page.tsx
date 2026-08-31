"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { useChangePassword, useUpdateProfile, useUploadAvatar } from "@/hooks/useAccount";
import { useMfaDisable, useMfaSetup, useMfaVerify } from "@/hooks/useMfa";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization, useUpdateOrganization } from "@/hooks/useOrganization";
import { ApiClientError } from "@/lib/api-client";
import { ImageUploadField } from "@/components/certificates/image-upload-field";
import { MfaQrCode } from "@/components/auth/mfa-qr-code";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  majorToMinor,
  minorToMajor,
  parseTrainingCurrency,
  resolveDefaultTrainingCostMinor,
  TRAINING_CURRENCIES,
  type TrainingCurrency,
} from "@/lib/money";

export default function SettingsPage() {
  const { user, organization, hasPermission } = useAuth();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const changePassword = useChangePassword();
  const { data: org } = useOrganization();
  const updateOrganization = useUpdateOrganization();
  const mfaSetup = useMfaSetup();
  const mfaVerify = useMfaVerify();
  const mfaDisable = useMfaDisable();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [orgName, setOrgName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaOtpauthUrl, setMfaOtpauthUrl] = useState<string | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const [ssoIssuer, setSsoIssuer] = useState("");
  const [ssoClientId, setSsoClientId] = useState("");
  const [ssoClientSecret, setSsoClientSecret] = useState("");
  const [ssoDomains, setSsoDomains] = useState("");
  const [allowSelfEnrollment, setAllowSelfEnrollment] = useState(false);
  const [showAnswersAfterAttempt, setShowAnswersAfterAttempt] = useState(false);
  const [trainingCurrency, setTrainingCurrency] = useState<TrainingCurrency>("MMK");
  const [defaultTrainingCost, setDefaultTrainingCost] = useState("");

  const canEditOrg = useMemo(() => hasPermission("org:write"), [hasPermission]);
  const mfaEnabled = user?.mfaEnabled ?? false;

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setAvatarUrl(user.avatarUrl ?? "");
    }
  }, [user]);

  useEffect(() => {
    if (org?.name) setOrgName(org.name);
    else if (organization?.name) setOrgName(organization.name);
  }, [org?.name, organization?.name]);

  useEffect(() => {
    const sso = org?.settings?.sso ?? organization?.settings?.sso;
    if (!sso) return;
    setSsoIssuer(sso.issuer ?? "");
    setSsoClientId(sso.clientId ?? "");
    setSsoClientSecret("");
    setSsoDomains((sso.domains ?? []).join(", "));
  }, [org?.settings?.sso, organization?.settings?.sso]);

  useEffect(() => {
    const enabled =
      org?.settings?.allowSelfEnrollment ?? organization?.settings?.allowSelfEnrollment ?? false;
    setAllowSelfEnrollment(enabled);
  }, [org?.settings?.allowSelfEnrollment, organization?.settings?.allowSelfEnrollment]);

  useEffect(() => {
    const show =
      org?.settings?.showAnswersAfterAttempt ??
      organization?.settings?.showAnswersAfterAttempt ??
      false;
    setShowAnswersAfterAttempt(show);
  }, [org?.settings?.showAnswersAfterAttempt, organization?.settings?.showAnswersAfterAttempt]);

  useEffect(() => {
    const settings = org?.settings ?? organization?.settings;
    const currency = parseTrainingCurrency(settings?.trainingCurrency);
    const minor = resolveDefaultTrainingCostMinor(settings);
    setTrainingCurrency(currency);
    setDefaultTrainingCost(minor > 0 ? String(minorToMajor(minor, currency)) : "");
  }, [org?.settings, organization?.settings]);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateProfile.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to update profile");
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to change password");
    }
  }

  async function handleOrgSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateOrganization.mutateAsync({ name: orgName.trim() });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to update organization");
    }
  }

  async function handleLearningSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateOrganization.mutateAsync({
        settings: {
          ...(org?.settings ?? organization?.settings ?? {}),
          allowSelfEnrollment,
          showAnswersAfterAttempt,
        },
      });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to update learning settings");
    }
  }

  async function handleTrainingRoiSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const minor = defaultTrainingCost.trim()
        ? majorToMinor(Number(defaultTrainingCost), trainingCurrency)
        : 0;
      await updateOrganization.mutateAsync({
        settings: {
          ...(org?.settings ?? organization?.settings ?? {}),
          trainingCurrency,
          defaultTrainingCostMinor: minor,
        },
      });
      toast.success("Training & ROI settings saved");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to update training settings");
    }
  }

  async function handleSsoSubmit(e: React.FormEvent) {
    e.preventDefault();
    const domains = ssoDomains
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    try {
      await updateOrganization.mutateAsync({
        settings: {
          ...(org?.settings ?? organization?.settings ?? {}),
          sso: {
            issuer: ssoIssuer.trim() || undefined,
            clientId: ssoClientId.trim() || undefined,
            clientSecret: ssoClientSecret.trim() || undefined,
            domains: domains.length ? domains : undefined,
            enabled: !!(ssoIssuer.trim() && ssoClientId.trim()),
          },
        },
      });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to update SSO settings");
    }
  }

  async function handleMfaSetup() {
    try {
      const result = await mfaSetup.mutateAsync();
      setMfaSecret(result.secret ?? null);
      setMfaOtpauthUrl(result.otpauthUrl ?? null);
    } catch {
      // toast handled in hook
    }
  }

  async function handleMfaVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaCode.trim()) return;
    try {
      await mfaVerify.mutateAsync(mfaCode.trim());
      setMfaCode("");
      setMfaSecret(null);
      setMfaOtpauthUrl(null);
    } catch {
      // toast handled in hook
    }
  }

  async function handleMfaDisable(e: React.FormEvent) {
    e.preventDefault();
    try {
      await mfaDisable.mutateAsync({ code: disableCode.trim(), password: disablePassword });
      setDisablePassword("");
      setDisableCode("");
    } catch {
      // toast handled in hook
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Settings"
        description="Manage your profile and account security."
      />
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-6 py-6">
        <Card className="shadow-luxury">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>
              {organization?.name ? `Signed in to ${organization.name}` : "Your account details"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email ?? ""} disabled />
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
              <ImageUploadField
                label="Profile photo"
                hint="PNG, JPEG, or WebP up to 800 KB."
                value={avatarUrl}
                uploading={uploadAvatar.isPending}
                onUpload={async (file) => {
                  const result = await uploadAvatar.mutateAsync(file);
                  setAvatarUrl(result.avatarUrl);
                }}
                onClear={async () => {
                  await updateProfile.mutateAsync({ avatarUrl: null });
                  setAvatarUrl("");
                }}
              />
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save profile"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-luxury">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              Two-factor authentication
            </CardTitle>
            <CardDescription>
              {mfaEnabled
                ? "MFA is enabled on your account."
                : "Add an extra layer of security with an authenticator app."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mfaEnabled ? (
              <form onSubmit={handleMfaDisable} className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Disabling MFA requires your authenticator code and current password.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="disableCode">Authenticator code</Label>
                  <Input
                    id="disableCode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disablePassword">Password</Label>
                  <Input
                    id="disablePassword"
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button type="submit" variant="destructive" disabled={mfaDisable.isPending}>
                  {mfaDisable.isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Disabling…
                    </>
                  ) : (
                    "Disable MFA"
                  )}
                </Button>
              </form>
            ) : (
              <>
                {!mfaSecret ? (
                  <Button type="button" onClick={handleMfaSetup} disabled={mfaSetup.isPending}>
                    {mfaSetup.isPending ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Setting up…
                      </>
                    ) : (
                      "Set up authenticator"
                    )}
                  </Button>
                ) : (
                  <form onSubmit={handleMfaVerify} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Scan QR code</Label>
                      <div className="bg-muted flex h-44 w-44 items-center justify-center rounded-lg border border-border p-2">
                        {mfaOtpauthUrl ? (
                          <MfaQrCode value={mfaOtpauthUrl} size={152} />
                        ) : (
                          <span className="text-muted-foreground px-2 text-center text-xs">
                            QR code unavailable
                          </span>
                        )}
                      </div>
                      {mfaSecret ? (
                        <p className="text-muted-foreground text-xs">
                          Manual entry key: <code className="font-mono">{mfaSecret}</code>
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mfaCode">Verification code</Label>
                      <Input
                        id="mfaCode"
                        inputMode="numeric"
                        placeholder="000000"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" disabled={mfaVerify.isPending}>
                      {mfaVerify.isPending ? (
                        <>
                          <Loader2 className="animate-spin" />
                          Verifying…
                        </>
                      ) : (
                        "Enable MFA"
                      )}
                    </Button>
                  </form>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {canEditOrg && (
          <Card className="shadow-luxury">
            <CardHeader>
              <CardTitle className="text-base">Organization</CardTitle>
              <CardDescription>Update your organization display name.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleOrgSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization name</Label>
                  <Input
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={updateOrganization.isPending}>
                    {updateOrganization.isPending ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save organization"
                    )}
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <Link href="/certificates/template">Certificate template</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {canEditOrg && (
          <Card className="shadow-luxury">
            <CardHeader>
              <CardTitle className="text-base">Training & ROI</CardTitle>
              <CardDescription>
                Default currency and per-completion cost used when a course has no specific training cost.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTrainingRoiSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="trainingCurrency">Currency</Label>
                    <Select
                      value={trainingCurrency}
                      onValueChange={(value) => setTrainingCurrency(value as TrainingCurrency)}
                    >
                      <SelectTrigger id="trainingCurrency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRAINING_CURRENCIES.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code === "MMK" ? "MMK — Myanmar Kyat" : "USD — US Dollar"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultTrainingCost">Default cost per completion ({trainingCurrency})</Label>
                    <Input
                      id="defaultTrainingCost"
                      type="number"
                      min={0}
                      step={trainingCurrency === "USD" ? "0.01" : "1"}
                      value={defaultTrainingCost}
                      onChange={(e) => setDefaultTrainingCost(e.target.value)}
                      placeholder={trainingCurrency === "USD" ? "e.g. 50.00" : "e.g. 50000"}
                    />
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  Course-specific costs can be set in Course Studio → About. Amounts are stored in minor units
                  ({trainingCurrency === "USD" ? "cents" : "whole kyats"}).
                </p>
                <Button type="submit" disabled={updateOrganization.isPending}>
                  {updateOrganization.isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save training settings"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {canEditOrg && (
          <Card className="shadow-luxury">
            <CardHeader>
              <CardTitle className="text-base">Learning</CardTitle>
              <CardDescription>Control how learners discover and join courses.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLearningSubmit} className="space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="allowSelfEnrollment"
                    checked={allowSelfEnrollment}
                    onCheckedChange={setAllowSelfEnrollment}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="allowSelfEnrollment" className="cursor-pointer">
                      Allow self-enrollment
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      When enabled, learners can enroll themselves from the course catalog.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="showAnswersAfterAttempt"
                    checked={showAnswersAfterAttempt}
                    onCheckedChange={setShowAnswersAfterAttempt}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="showAnswersAfterAttempt" className="cursor-pointer">
                      Show correct answers after attempt
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      When enabled, learners see which questions they got right or wrong after submitting an assessment.
                    </p>
                  </div>
                </div>
                <Button type="submit" disabled={updateOrganization.isPending}>
                  {updateOrganization.isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save learning settings"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {canEditOrg && (
          <Card className="shadow-luxury">
            <CardHeader>
              <CardTitle className="text-base">Single sign-on (SSO)</CardTitle>
              <CardDescription>
                Configure OIDC/SAML provider settings for your organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSsoSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ssoIssuer">Issuer URL</Label>
                  <Input
                    id="ssoIssuer"
                    placeholder="https://login.example.com"
                    value={ssoIssuer}
                    onChange={(e) => setSsoIssuer(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ssoClientId">Client ID</Label>
                  <Input
                    id="ssoClientId"
                    value={ssoClientId}
                    onChange={(e) => setSsoClientId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ssoClientSecret">Client secret</Label>
                  <Input
                    id="ssoClientSecret"
                    type="password"
                    value={ssoClientSecret}
                    onChange={(e) => setSsoClientSecret(e.target.value)}
                    autoComplete="off"
                    placeholder={
                      (org?.settings?.sso ?? organization?.settings?.sso)?.clientSecretSet
                        ? "Secret is set — enter a new value to rotate"
                        : "Client secret"
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ssoDomains">Allowed email domains</Label>
                  <Input
                    id="ssoDomains"
                    placeholder="company.com, subsidiary.com"
                    value={ssoDomains}
                    onChange={(e) => setSsoDomains(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">Comma-separated list of domains.</p>
                </div>
                <Button type="submit" disabled={updateOrganization.isPending}>
                  {updateOrganization.isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save SSO settings"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {(canEditOrg && (hasPermission("audit:read") || hasPermission("api-key:write") || hasPermission("webhook:write"))) && (
          <Card className="shadow-luxury">
            <CardHeader>
              <CardTitle className="text-base">Administration</CardTitle>
              <CardDescription>Audit logs, BI integrations, and webhooks.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {hasPermission("audit:read") && (
                <Button type="button" variant="outline" asChild>
                  <Link href="/settings/audit-logs">Audit logs</Link>
                </Button>
              )}
              {(hasPermission("api-key:write") || hasPermission("webhook:write")) && (
                <Button type="button" variant="outline" asChild>
                  <Link href="/settings/integrations">Integrations</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-luxury">
          <CardHeader>
            <CardTitle className="text-base">Password</CardTitle>
            <CardDescription>Update your password. Minimum 12 characters.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={12}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={12}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Updating…
                  </>
                ) : (
                  "Change password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
