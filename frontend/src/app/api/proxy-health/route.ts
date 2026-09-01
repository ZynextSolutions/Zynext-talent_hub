import { NextResponse } from "next/server";
import {
  apiProxyTarget,
  isRailwayInternalTarget,
  proxyUpstreamFetch,
} from "@/lib/api-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const target = apiProxyTarget();
  const readyUrl = `${target}/ready`;
  const railwayInternal = isRailwayInternalTarget(target);

  try {
    const res = await proxyUpstreamFetch(readyUrl, { method: "GET", cache: "no-store" });
    const body = await res.text();
    let parsed: unknown = body;
    try {
      parsed = JSON.parse(body);
    } catch {
      // keep raw text
    }
    return NextResponse.json({
      status: res.ok ? "ok" : "upstream_error",
      apiProxyTarget: target,
      railwayInternal,
      readyUrl,
      upstreamStatus: res.status,
      upstreamBody: parsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cause =
      err instanceof Error && err.cause instanceof Error
        ? err.cause.message
        : err instanceof Error && err.cause
          ? String(err.cause)
          : undefined;
    return NextResponse.json(
      {
        status: "unreachable",
        apiProxyTarget: target,
        railwayInternal,
        readyUrl,
        error: message,
        cause,
        hint: !target || target.includes("localhost")
          ? "API_PROXY_TARGET is missing or still localhost. On web set http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}} (reference variables)."
          : "Target looks set but TCP failed. API must listen on :: (IPv6) for Railway private networking; redeploy api+web after the bind fix.",
      },
      { status: 502 },
    );
  }
}
