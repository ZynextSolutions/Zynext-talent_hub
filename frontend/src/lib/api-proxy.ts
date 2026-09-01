import dns from "node:dns/promises";
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

const connectTimeoutMs = 8_000;

/** Prefer Happy Eyeballs so dual-stack Railway envs work; still reaches IPv6-only private nets. */
const railwayAgent = new Agent({
  connect: {
    autoSelectFamily: true,
    autoSelectFamilyAttemptTimeout: 500,
    timeout: connectTimeoutMs,
  },
});

const railwayIpv6Agent = new Agent({
  connect: {
    family: 6,
    timeout: connectTimeoutMs,
  },
});

const railwayIpv4Agent = new Agent({
  connect: {
    family: 4,
    timeout: connectTimeoutMs,
  },
});

export function apiProxyTarget(): string {
  const candidates = [
    (process.env.API_PROXY_TARGET ?? "").trim().replace(/\/$/, ""),
    (() => {
      const host = (process.env.API_HOST ?? "").trim();
      const port = (process.env.API_PORT ?? "").trim();
      return host && port ? `http://${host}:${port}` : "";
    })(),
    // Last-resort Railway convention when the service is named "api".
    process.env.RAILWAY_ENVIRONMENT && process.env.API_PORT
      ? `http://api.railway.internal:${process.env.API_PORT}`
      : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    // Unresolved Railway reference variables — skip so we can try the next candidate.
    if (candidate.includes("${{") || candidate.includes("RAILWAY_PRIVATE_DOMAIN}")) continue;
    return candidate;
  }

  return "http://localhost:4000";
}

export function isRailwayInternalTarget(target: string = apiProxyTarget()): boolean {
  try {
    const host = new URL(target).hostname;
    return host.endsWith(".railway.internal") || host.endsWith(".railway.internal.");
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

function undiciInit(init: ProxyFetchInit, dispatcher: Agent): Parameters<typeof undiciFetch>[1] {
  return {
    method: init.method,
    headers: init.headers as HeadersInit,
    body: init.body as never,
    redirect: init.redirect,
    duplex: init.duplex,
    dispatcher,
  } as Parameters<typeof undiciFetch>[1];
}

async function fetchWithAgent(
  url: string,
  init: ProxyFetchInit,
  agent: Agent,
): Promise<Response> {
  const res = await undiciFetch(url, undiciInit(init, agent));
  return res as unknown as Response;
}

/**
 * Upstream fetch for the Next.js → API proxy.
 * On Railway private DNS, try Happy Eyeballs, then IPv6, then IPv4, then literal IPs.
 */
export async function proxyUpstreamFetch(url: string, init: ProxyFetchInit): Promise<Response> {
  if (!isRailwayInternalTarget(url) && !isRailwayInternalTarget()) {
    return fetch(url, init);
  }

  const errors: string[] = [];
  for (const [label, agent] of [
    ["auto", railwayAgent],
    ["ipv6", railwayIpv6Agent],
    ["ipv4", railwayIpv4Agent],
  ] as const) {
    try {
      return await fetchWithAgent(url, init, agent);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const cause =
        err instanceof Error && err.cause instanceof Error
          ? err.cause.message
          : err instanceof Error && err.cause
            ? String(err.cause)
            : undefined;
      errors.push(`${label}: ${msg}${cause ? ` (${cause})` : ""}`);
    }
  }

  // Final attempt: dial resolved AAAA/A literals (Host header preserved).
  try {
    const parsed = new URL(url);
    const records = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
    for (const rec of records) {
      const hostLiteral = rec.family === 6 ? `[${rec.address}]` : rec.address;
      const literalUrl = new URL(url);
      literalUrl.hostname = hostLiteral;
      const headers = new Headers(init.headers as HeadersInit);
      if (!headers.has("host")) headers.set("host", parsed.host);
      try {
        return await fetchWithAgent(
          literalUrl.toString(),
          { ...init, headers },
          rec.family === 6 ? railwayIpv6Agent : railwayIpv4Agent,
        );
      } catch (err) {
        errors.push(
          `literal-${rec.family}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    errors.push(`dns: ${err instanceof Error ? err.message : String(err)}`);
  }

  throw new Error(`All private-network fetch attempts failed: ${errors.join(" | ")}`);
}

export async function diagnoseProxyTarget(target: string = apiProxyTarget()) {
  let hostname = "";
  let port = "";
  try {
    const u = new URL(target);
    hostname = u.hostname;
    port = u.port || (u.protocol === "https:" ? "443" : "80");
  } catch {
    return {
      target,
      parseError: "API_PROXY_TARGET is not a valid URL",
      hint: 'Set web env API_PROXY_TARGET to http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}',
    };
  }

  let addresses: Array<{ address: string; family: number }> = [];
  let lookupError: string | undefined;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (err) {
    lookupError = err instanceof Error ? err.message : String(err);
  }

  const readyUrl = `${target.replace(/\/$/, "")}/ready`;
  const attempts: Array<{ mode: string; ok: boolean; status?: number; error?: string }> = [];

  for (const [mode, agent] of [
    ["auto", railwayAgent],
    ["ipv6", railwayIpv6Agent],
    ["ipv4", railwayIpv4Agent],
  ] as const) {
    try {
      const res = await fetchWithAgent(readyUrl, { method: "GET" }, agent);
      attempts.push({ mode, ok: res.ok, status: res.status });
      if (res.ok) break;
    } catch (err) {
      attempts.push({
        mode,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const ok = attempts.some((a) => a.ok);
  const looksUnresolved =
    target.includes("${{") || target.includes("RAILWAY_PRIVATE_DOMAIN") || hostname === "localhost";

  return {
    target,
    hostname,
    port,
    railwayInternal: isRailwayInternalTarget(target),
    addresses,
    lookupError,
    attempts,
    ok,
    hint: ok
      ? undefined
      : looksUnresolved
        ? "API_PROXY_TARGET is missing or not interpolated. In Railway web Variables set exactly: http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}} (service name must match)."
        : lookupError
          ? "DNS failed for private hostname — api and web must be in the same Railway environment; private networking must be enabled."
          : "DNS resolved but TCP to /ready failed. On api set LISTEN_HOST=:: (or redeploy latest API which binds :: on Railway) and confirm api /ready is healthy.",
  };
}
