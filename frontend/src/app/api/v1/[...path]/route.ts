import { NextRequest, NextResponse } from "next/server";
import {
  buildProxyUrl,
  forwardRequestHeaders,
  forwardResponseHeaders,
} from "@/lib/api-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { path } = await context.params;
  const url = buildProxyUrl(path, req.nextUrl.search);
  const headers = forwardRequestHeaders(req.headers);

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    init.duplex = "half";
  }

  const upstream = await fetch(url, init);
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: forwardResponseHeaders(upstream.headers),
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
