import { Agent, fetch as undiciFetch } from "undici";

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

/** Railway private DNS is IPv6; undici often hangs/fails unless family is forced. */
const railwayInternalAgent = new Agent({
  connect: {
    family: 6,
    timeout: 10_000,
  },
});

export function apiProxyTarget(): string {
  return (process.env.API_PROXY_TARGET ?? "http://localhost:4000").trim().replace(/\/$/, "");
}

export function isRailwayInternalTarget(target: string = apiProxyTarget()): boolean {
  try {
    return new URL(target).hostname.endsWith(".railway.internal");
  } catch {
    return false;
  }
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

type ProxyFetchInit = RequestInit & { duplex?: "half" };

/**
 * Upstream fetch for the Next.js → API proxy.
 * Uses an IPv6-only undici Agent when targeting Railway private networking.
 */
export async function proxyUpstreamFetch(url: string, init: ProxyFetchInit): Promise<Response> {
  if (isRailwayInternalTarget(url) || isRailwayInternalTarget()) {
    // undici RequestInit differs slightly from DOM/lib.dom RequestInit (stream body types).
    const res = await undiciFetch(url, {
      method: init.method,
      headers: init.headers as HeadersInit,
      body: init.body as never,
      redirect: init.redirect,
      duplex: init.duplex,
      dispatcher: railwayInternalAgent,
    } as Parameters<typeof undiciFetch>[1]);
    return res as unknown as Response;
  }
  return fetch(url, init);
}
