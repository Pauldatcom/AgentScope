export const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-8))",
];

export const AXIS_PROPS = {
  stroke: "hsl(var(--muted-foreground))",
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: "hsl(var(--border))" },
} as const;

export const GRID_PROPS = {
  stroke: "hsl(var(--border))",
  strokeDasharray: "3 3",
  strokeOpacity: 0.5,
} as const;
