"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: string;
  className?: string;
}

export function StatCard({ title, value, description, icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden border-border/60 bg-kpi-gradient shadow-luxury", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm font-medium">{title}</p>
            <p className="text-3xl font-semibold tracking-tight">{value}</p>
            {description && <p className="text-muted-foreground text-xs">{description}</p>}
            {trend && <p className="text-indigo text-xs font-medium">{trend}</p>}
          </div>
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo/10 text-indigo ring-1 ring-indigo/20">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
