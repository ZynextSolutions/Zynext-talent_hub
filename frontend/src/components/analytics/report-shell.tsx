"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ReportKpi = {
  label: string;
  value: string | number;
  hint?: string;
  proxy?: boolean;
};

export type ReportInsight = {
  severity?: "high" | "medium" | "low";
  message: string;
};

interface ReportShellProps {
  title: string;
  period: string;
  scope: string;
  kpis: ReportKpi[];
  risks: ReportInsight[];
  recommendations: ReportInsight[];
  loading?: boolean;
  gapNote?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

function severityClass(severity?: ReportInsight["severity"]) {
  if (severity === "high") return "border-destructive/30 bg-destructive/5";
  if (severity === "medium") return "border-amber-500/30 bg-amber-500/5";
  return "border-border bg-muted/40";
}

export function ReportShell({
  title,
  period,
  scope,
  kpis,
  risks,
  recommendations,
  loading,
  gapNote,
  actions,
  children,
}: ReportShellProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-muted-foreground text-sm">
            {period} · {scope}
          </p>
        </div>
        {actions}
      </div>

      {gapNote && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {gapNote}
        </div>
      )}

      {loading || kpis.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading
            ? Array.from({ length: Math.max(kpis.length, 4) }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))
            : kpis.map((kpi) => (
                <Card key={kpi.label} className="bg-kpi-gradient shadow-luxury">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-muted-foreground text-sm">{kpi.label}</p>
                      {kpi.proxy && (
                        <Badge variant="outline" className="text-[10px] uppercase">
                          Proxy
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{kpi.value}</p>
                    {kpi.hint && <p className="text-muted-foreground mt-1 text-xs">{kpi.hint}</p>}
                  </CardContent>
                </Card>
              ))}
        </div>
      ) : null}

      {children}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-luxury">
          <CardHeader>
            <CardTitle className="text-base">Risks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : risks.length ? (
              risks.map((risk) => (
                <div
                  key={risk.message}
                  className={cn("rounded-md border px-3 py-2 text-sm", severityClass(risk.severity))}
                >
                  {risk.message}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No material risks in this view.</p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-luxury">
          <CardHeader>
            <CardTitle className="text-base">Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : recommendations.length ? (
              recommendations.map((rec) => (
                <div key={rec.message} className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                  {rec.message}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No actions suggested from current numbers.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
