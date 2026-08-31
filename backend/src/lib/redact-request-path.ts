const SECRET_QUERY_KEYS = new Set(['ticket', 'access_token', 'token', 'code']);

export function redactRequestPath(url: string): string {
  const q = url.indexOf('?');
  if (q === -1) return url;
  const path = url.slice(0, q);
  const params = new URLSearchParams(url.slice(q + 1));
  let changed = false;
  for (const key of [...params.keys()]) {
    if (SECRET_QUERY_KEYS.has(key.toLowerCase())) {
      params.set(key, 'redacted');
      changed = true;
    }
  }
  if (!changed) return url;
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}
