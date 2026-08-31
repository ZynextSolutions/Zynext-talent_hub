"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  useApiKeys,
  useCreateApiKey,
  useCreateWebhook,
  useDeleteWebhook,
  useRevokeApiKey,
  useWebhooks,
} from "@/hooks/usePhase3";
import { useAuth } from "@/hooks/useAuth";
import { API_URL } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const WEBHOOK_EVENTS = [
  "enrollment.completed",
  "report.delivered",
] as const;

const API_SCOPES = ["reports:read"] as const;

export default function IntegrationsPage() {
  const { hasPermission } = useAuth();
  const canKeys = hasPermission("api-key:write");
  const canWebhooks = hasPermission("webhook:write");

  const { data: keys, isLoading: keysLoading } = useApiKeys(canKeys);
  const { data: hooks, isLoading: hooksLoading } = useWebhooks(canWebhooks);
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();
  const createWebhook = useCreateWebhook();
  const deleteWebhook = useDeleteWebhook();

  const [keyName, setKeyName] = useState("");
  const [keyScopes, setKeyScopes] = useState<string[]>(["reports:read"]);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>(["enrollment.completed"]);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);

  if (!canKeys && !canWebhooks) {
    return (
      <div className="flex flex-1 flex-col overflow-auto">
        <PageHeader title="Integrations" description="You do not have permission to manage integrations." />
      </div>
    );
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    const result = await createKey.mutateAsync({ name: keyName.trim(), scopes: keyScopes });
    setNewKeySecret(result.secret);
    setKeyName("");
    toast.success("API key created — copy the secret now");
  }

  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    const result = await createWebhook.mutateAsync({ url: webhookUrl.trim(), events: webhookEvents });
    setNewWebhookSecret(result.secret);
    setWebhookUrl("");
    toast.success("Webhook created — copy the signing secret now");
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Integrations"
        description="API keys for BI exports and outbound webhooks."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" />
              Settings
            </Link>
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-6">
        {canKeys && (
          <Card className="shadow-luxury">
            <CardHeader>
              <CardTitle className="text-base">API keys</CardTitle>
              <CardDescription>
                Use keys with the <code className="text-xs">X-Api-Key</code> header on{" "}
                <code className="text-xs">/bi/reports/:type</code>.{" "}
                <Link href={`${API_URL}/docs/openapi.json`} className="underline" target="_blank">
                  OpenAPI spec
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {newKeySecret && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <p className="font-medium">Copy your API key — it will not be shown again.</p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 break-all font-mono text-xs">{newKeySecret}</code>
                    <Button type="button" variant="outline" size="icon" onClick={() => copyText(newKeySecret)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              <form onSubmit={handleCreateKey} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Key name</Label>
                  <Input id="keyName" value={keyName} onChange={(e) => setKeyName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Scopes</Label>
                  {API_SCOPES.map((scope) => (
                    <label key={scope} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={keyScopes.includes(scope)}
                        onCheckedChange={(checked) =>
                          setKeyScopes((prev) =>
                            checked ? [...prev, scope] : prev.filter((s) => s !== scope),
                          )
                        }
                      />
                      {scope}
                    </label>
                  ))}
                </div>
                <Button type="submit" size="sm" disabled={createKey.isPending || !keyScopes.length}>
                  {createKey.isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create key
                    </>
                  )}
                </Button>
              </form>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keysLoading ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : keys?.length ? (
                    keys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell className="font-mono text-xs">{key.keyPrefix}…</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{key.scopes.join(", ")}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Revoke key"
                            onClick={() => revokeKey.mutate(key.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground text-center">
                        No API keys yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {canWebhooks && (
          <Card className="shadow-luxury">
            <CardHeader>
              <CardTitle className="text-base">Webhooks</CardTitle>
              <CardDescription>
                Receive POST callbacks with an <code className="text-xs">X-Cor-Signature</code> HMAC header.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {newWebhookSecret && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <p className="font-medium">Copy your webhook signing secret.</p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 break-all font-mono text-xs">{newWebhookSecret}</code>
                    <Button type="button" variant="outline" size="icon" onClick={() => copyText(newWebhookSecret)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              <form onSubmit={handleCreateWebhook} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Endpoint URL</Label>
                  <Input
                    id="webhookUrl"
                    type="url"
                    placeholder="https://example.com/hooks/cor-lms"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Events</Label>
                  {WEBHOOK_EVENTS.map((event) => (
                    <label key={event} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={webhookEvents.includes(event)}
                        onCheckedChange={(checked) =>
                          setWebhookEvents((prev) =>
                            checked ? [...prev, event] : prev.filter((e) => e !== event),
                          )
                        }
                      />
                      {event}
                    </label>
                  ))}
                </div>
                <Button type="submit" size="sm" disabled={createWebhook.isPending || !webhookEvents.length}>
                  {createWebhook.isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Add webhook
                    </>
                  )}
                </Button>
              </form>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hooksLoading ? (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : hooks?.length ? (
                    hooks.map((hook) => (
                      <TableRow key={hook.id}>
                        <TableCell className="max-w-xs truncate font-mono text-xs">{hook.url}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{hook.events.join(", ")}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete webhook"
                            onClick={() => deleteWebhook.mutate(hook.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground text-center">
                        No webhooks configured.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
