"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface EnrollmentTimePoint {
  date: string;
  enrolled: number;
  completed: number;
}

export function EnrollmentAreaChart({ data }: { data: EnrollmentTimePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="enrolledGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
        <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
        <Area
          type="monotone"
          dataKey="enrolled"
          stroke="#6366F1"
          fill="url(#enrolledGrad)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="completed"
          stroke="#818CF8"
          fill="transparent"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
