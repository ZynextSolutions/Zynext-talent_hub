const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

export function apiProxyTarget(): string {
  return (process.env.API_PROXY_TARGET ?? "http://localhost:4000").trim().replace(/\/$/, "");
}

export function buildProxyUrl(pathSegments: string[], search: string): string {
  const suffix = pathSegments.join("/");
  return `${apiProxyTarget()}/api/v1/${suffix}${search}`;
}

export function forwardRequestHeaders(headers: Headers): Headers {
  const out = new Headers();
  headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      out.set(key, value);
    }
  });
  return out;
}

export function forwardResponseHeaders(headers: Headers): Headers {
  const out = new Headers();
  headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      out.set(key, value);
    }
  });
  return out;
}
