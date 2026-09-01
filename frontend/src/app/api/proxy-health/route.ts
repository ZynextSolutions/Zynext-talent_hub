import { NextResponse } from "next/server";
import { apiProxyTarget } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const target = apiProxyTarget();
  const readyUrl = `${target}/ready`;

  try {
    const res = await fetch(readyUrl, { cache: "no-store" });
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
      readyUrl,
      upstreamStatus: res.status,
      upstreamBody: parsed,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "unreachable",
        apiProxyTarget: target,
        readyUrl,
        error: err instanceof Error ? err.message : String(err),
        hint:
          "Set API_PROXY_TARGET on web to http://${{YOUR_API_SERVICE.RAILWAY_PRIVATE_DOMAIN}}:${{YOUR_API_SERVICE.PORT}}. If target shows localhost:4000, the variable is missing.",
      },
      { status: 502 },
    );
  }
}
