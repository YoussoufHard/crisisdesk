"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { formatShortTime } from "@/lib/format";
import type { MetricPoint } from "@/lib/data/types";

export interface ChartSeries {
  key: keyof MetricPoint;
  label: string;
  color: string;
  unit?: string;
}

interface MetricLineChartProps {
  data: MetricPoint[];
  series: ChartSeries[];
  height?: number;
}

export function MetricLineChart({ data, series, height = 180 }: MetricLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatShortTime}
          stroke="var(--muted-foreground)"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          minTickGap={40}
        />
        <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
        <Tooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => formatShortTime(String(v))}
          formatter={(value, name) => {
            const s = series.find((s) => s.label === name);
            return [`${value}${s?.unit ?? ""}`, name as string];
          }}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
