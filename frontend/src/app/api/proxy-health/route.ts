import { NextResponse } from "next/server";
import { diagnoseProxyTarget } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const diagnosis = await diagnoseProxyTarget();
  return NextResponse.json(
    {
      status: diagnosis.ok ? "ok" : "unreachable",
      ...diagnosis,
    },
    { status: diagnosis.ok ? 200 : 502 },
  );
}
