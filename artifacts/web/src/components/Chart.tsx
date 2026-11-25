import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
} from "recharts";
import { colorFor, fmtNum, fmtTime } from "@/lib/format";

export interface ChartSeries {
  label: string;
  points: [number, number][];
  color?: string;
}

export function TimeseriesChart({
  series,
  type = "line",
  height = 200,
  palette = "classic",
  thresholds,
  yFormat = fmtNum,
  stacked,
  from,
  to,
  showLegend = false,
  peaks = false,
}: {
  series: ChartSeries[];
  type?: "line" | "area" | "bars";
  height?: number | string;
  palette?: string;
  thresholds?: { value: number; color: string; label?: string; above?: boolean }[];
  yFormat?: (v: number) => string;
  stacked?: boolean;
  from?: number;
  to?: number;
  showLegend?: boolean;
  peaks?: boolean;
}) {
  const { data, keys } = useMemo(() => {
    const rows = new Map<number, any>();
    const keys = series.map((s, i) => ({ key: `s${i}`, label: s.label || "value", color: s.color ?? colorFor(i, palette) }));
    series.forEach((s, i) => {
      for (const [t, v] of s.points) {
        let r = rows.get(t);
        if (!r) rows.set(t, (r = { t }));
        r[`s${i}`] = v;
      }
    });
    return { data: [...rows.values()].sort((a, b) => a.t - b.t), keys };
  }, [series, palette]);
  const peakPts = useMemo(() => {
    if (!peaks || type !== "line" || series.length !== 1) return [] as [number, number][];
    const pts = series[0].points.filter((p) => Number.isFinite(p[1]));
    if (pts.length < 8) return [];
    const vals = pts.map((p) => p[1]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 0;
    const seg = Math.ceil(pts.length / 3);
    const out: [number, number][] = [];
    for (let i = 0; i < pts.length; i += seg) {
      const chunk = pts.slice(i, i + seg);
      const m = chunk.reduce((a, b) => (b[1] > a[1] ? b : a), chunk[0]);
      if (m && m[1] > mean + 1.5 * sd) out.push(m);
    }
    return out;
  }, [series, peaks, type]);
  const span = data.length > 1 ? data[data.length - 1].t - data[0].t : 3600_000;
  const tickFmt = (t: number) => (span > 2 * 86400_000 ? new Date(t).toLocaleDateString([], { month: "short", day: "numeric" }) : fmtTime(t).slice(0, 5));
  if (!data.length)
    return (
      <div style={{ height }} className="flex items-center justify-center text-ink-3 text-xs">
        No data
      </div>
    );
  const common = {
    data,
    margin: { top: 6, right: 8, left: 0, bottom: 0 },
  };
  // An array rather than a fragment: recharts only finds direct children, and its fragment check misses React 19 elements.
  const axes = [
    <CartesianGrid key="grid" stroke="#eceef2" vertical={false} />,
    <XAxis
      key="x"
      dataKey="t"
      type="number"
      scale="time"
      domain={from && to ? [from * 1000, to * 1000] : ["dataMin", "dataMax"]}
      tickFormatter={tickFmt}
      tick={{ fontSize: 10, fill: "#7d8b96" }}
      axisLine={{ stroke: "#e2e5ea" }}
      tickLine={false}
      minTickGap={40}
    />,
    <YAxis key="y" tickFormatter={(v) => yFormat(v)} tick={{ fontSize: 10, fill: "#7d8b96" }} axisLine={false} tickLine={false} width={52} />,
    <Tooltip
      key="tooltip"
      isAnimationActive={false}
      labelFormatter={(t) => fmtTime(Number(t), true)}
      formatter={(v: any, name: any) => [yFormat(Number(v)), keys.find((k) => k.key === name)?.label ?? name]}
      contentStyle={{ fontSize: 11, padding: "6px 8px", borderRadius: 4, border: "1px solid #e2e5ea" }}
      itemStyle={{ padding: 0 }}
    />,
    thresholds?.map((th, i) => (
      <ReferenceLine
        key={i}
        y={th.value}
        stroke={th.color}
        strokeDasharray="4 3"
        label={th.label ? { value: th.label, fontSize: 10, fill: th.color, position: "insideTopRight" } : undefined}
      />
    )),
    thresholds
      ?.filter((t) => t.above !== undefined)
      .map((th, i) => (
        <ReferenceArea key={`a${i}`} y1={th.above ? th.value : undefined} y2={th.above ? undefined : th.value} fill={th.color} fillOpacity={0.06} />
      )),
  ];
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height={showLegend ? "82%" : "100%"}>
        {type === "bars" ? (
          <BarChart {...common}>
            {axes}
            {keys.map((k) => (
              <Bar key={k.key} dataKey={k.key} fill={k.color} stackId={stacked !== false ? "a" : undefined} isAnimationActive={false} />
            ))}
          </BarChart>
        ) : type === "area" ? (
          <AreaChart {...common}>
            {axes}
            {keys.map((k) => (
              <Area
                key={k.key}
                dataKey={k.key}
                stroke={k.color}
                fill={k.color}
                fillOpacity={0.35}
                strokeWidth={1.5}
                stackId={stacked !== false ? "a" : undefined}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart {...common} margin={{ top: peakPts.length ? 16 : 6, right: 8, left: 0, bottom: 0 }}>
            {axes}
            {keys.map((k) => (
              <Line key={k.key} dataKey={k.key} stroke={k.color} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
            ))}
            {peakPts.map(([t, v]) => (
              <ReferenceDot
                key={t}
                x={t}
                y={v}
                r={2.5}
                fill={keys[0].color}
                stroke="none"
                label={{ value: yFormat(v), position: "top", fontSize: 10, fontWeight: 600, fill: keys[0].color }}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
      {showLegend && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-2 overflow-auto max-h-[18%] text-[11px] text-ink-2">
          {keys.map((k) => (
            <span key={k.key} className="inline-flex items-center gap-1">
              <span className="w-2.5 h-0.5" style={{ background: k.color }} />
              {k.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
