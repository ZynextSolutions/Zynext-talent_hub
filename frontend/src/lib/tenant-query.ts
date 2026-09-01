/** Append organizationId for platform-admin cross-tenant API calls. */
export function withTenantQuery(path: string, organizationId?: string | null): string {
  if (!organizationId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}organizationId=${encodeURIComponent(organizationId)}`;
}
