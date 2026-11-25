import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Copy, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useTime } from "@/lib/time";
import { colorFor, fmtNum, fmtTime, STATUS_COLORS } from "@/lib/format";
import { TimeseriesChart } from "./Chart";
import { StatusBadge } from "./Panels";
import { cardStyles, tableStyles } from "@/components/ui";

export interface WidgetDef {
  id?: number;
  definition: any;
  layout?: { x: number; y: number; width: number; height: number };
}

// vars arrive as { name: "prefix:value" }; the API also wants { "name.value": value }
function expandVars(vars: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    out[k] = v;
    out[`${k}.value`] = v === "*" ? "*" : v.includes(":") ? v.split(":").slice(1).join(":") : v;
  }
  return out;
}

function useWidgetData(def: any, vars: Record<string, string>, scalar: boolean) {
  const { from, to, tick } = useTime();
  const reqs = def.requests ?? [];
  return useQuery({
    queryKey: ["widget", JSON.stringify(reqs), from, to, tick, JSON.stringify(vars), scalar],
    queryFn: async () => {
      const out: { series: any[]; display: string; aggregator?: string }[] = [];
      for (const r of reqs) {
        const queries = r.queries ?? (r.q ? [{ name: "a", query: r.q }] : []);
        const formulas = r.formulas;
        const res = await api<{ series: any[] }>("/ui/metrics/query", { body: { queries, formulas, from, to, vars: expandVars(vars) } });
        out.push({ series: res.series, display: r.display_type ?? "line", aggregator: r.queries?.[0]?.aggregator ?? r.aggregator });
      }
      return out;
    },
    enabled: reqs.length > 0,
    refetchOnWindowFocus: false,
  });
}

function label(s: any) {
  return s.alias ? (s.group.length ? `${s.alias} {${s.group.join(",")}}` : s.alias) : s.group.length ? s.group.join(",") : s.formula;
}

function reduceVals(points: [number, number][], agg = "avg") {
  const vs = points.map((p) => p[1]);
  if (!vs.length) return NaN;
  if (agg === "sum") return vs.reduce((a, b) => a + b, 0);
  if (agg === "max") return Math.max(...vs);
  if (agg === "min") return Math.min(...vs);
  if (agg === "last") return vs[vs.length - 1];
  return vs.reduce((a, b) => a + b, 0) / vs.length;
}

function TimeseriesBody({ def, vars }: { def: any; vars: Record<string, string> }) {
  const { from, to } = useTime();
  const q = useWidgetData(def, vars, false);
  if (q.isLoading) return <div className="h-full animate-pulse bg-panel rounded" />;
  if (q.error) return <div className="text-alert text-xs p-2">{String((q.error as any).message)}</div>;
  const reqs = q.data ?? [];
  const series = reqs.flatMap((r) => r.series.map((s) => ({ label: label(s), points: s.pointlist })));
  const display = reqs[0]?.display ?? "line";
  const markers = (def.markers ?? []).map((m: any) => ({
    value: Number(String(m.value).replace(/[^\d.\-]/g, "")),
    color: m.display_type?.startsWith("error") ? "#d33b4c" : m.display_type?.startsWith("warning") ? "#e8a317" : "#2ca05a",
    label: m.label,
  }));
  return (
    <TimeseriesChart
      series={series}
      type={display === "bars" ? "bars" : display === "area" ? "area" : "line"}
      height="100%"
      palette={def.requests?.[0]?.style?.palette}
      from={from}
      to={to}
      thresholds={markers}
      showLegend={def.show_legend !== false && series.length > 1 && series.length <= 12}
      peaks
    />
  );
}

function QueryValueBody({ def, vars }: { def: any; vars: Record<string, string> }) {
  const q = useWidgetData(def, vars, true);
  const r = q.data?.[0];
  const s = r?.series?.[0];
  const v = s ? reduceVals(s.pointlist, r?.aggregator ?? def.requests?.[0]?.aggregator ?? "avg") : NaN;
  let color = "#1c2b36";
  let bg = "transparent";
  for (const c of def.requests?.[0]?.conditional_formats ?? []) {
    const ok =
      c.comparator === ">"
        ? v > c.value
        : c.comparator === ">="
          ? v >= c.value
          : c.comparator === "<"
            ? v < c.value
            : c.comparator === "<="
              ? v <= c.value
              : v === c.value;
    if (ok) {
      const pal = String(c.palette ?? "");
      const col = pal.includes("red") ? "#d33b4c" : pal.includes("yellow") ? "#e8a317" : pal.includes("green") ? "#2ca05a" : "#1c2b36";
      if (pal.startsWith("white_on")) {
        bg = col;
        color = "#fff";
      } else color = col;
      break;
    }
  }
  return (
    <div className="h-full flex items-center justify-start px-2 rounded-[3px]" style={{ background: bg }}>
      {q.isLoading ? (
        <div className="w-24 h-10 bg-panel animate-pulse rounded" />
      ) : (
        <span className="font-bold tracking-tight leading-none" style={{ color, fontSize: "clamp(26px, 2.6vw, 44px)" }}>
          {fmtNum(v, def.precision ?? 2)}
          <span className="text-[0.5em] ml-1 font-semibold" style={{ color: bg === "transparent" ? "#4a5a67" : color }}>
            {def.custom_unit ?? ""}
          </span>
        </span>
      )}
    </div>
  );
}

function TopListBody({ def, vars }: { def: any; vars: Record<string, string> }) {
  const q = useWidgetData(def, vars, true);
  const r = q.data?.[0];
  const rows = (r?.series ?? [])
    .map((s: any) => ({ label: s.group.join(",") || label(s), v: reduceVals(s.pointlist, r?.aggregator ?? "avg") }))
    .filter((x: any) => !Number.isNaN(x.v))
    .sort((a: any, b: any) => b.v - a.v)
    .slice(0, def.requests?.[0]?.limit ?? 10);
  const max = Math.max(...rows.map((r: any) => Math.abs(r.v)), 1);
  return (
    <div className="h-full overflow-auto scroll-thin space-y-1 pr-1">
      {rows.length === 0 && !q.isLoading && <div className="text-ink-3 text-xs">No data</div>}
      {rows.map((r: any, i: number) => (
        <div key={r.label} className="flex items-center gap-2 text-xs">
          <div className="w-1/3 truncate text-right text-ink-2" title={r.label}>
            {r.label}
          </div>
          <div className="flex-1 h-5 bg-panel rounded overflow-hidden">
            <div className="h-full rounded" style={{ width: `${(Math.abs(r.v) / max) * 100}%`, background: colorFor(i) }} />
          </div>
          <div className="w-14 text-right font-semibold">{fmtNum(r.v)}</div>
        </div>
      ))}
    </div>
  );
}

function TableBody({ def, vars }: { def: any; vars: Record<string, string> }) {
  const q = useWidgetData(def, vars, true);
  const r = q.data?.[0];
  const groups = new Map<string, Record<string, number>>();
  const cols: string[] = [];
  for (const s of r?.series ?? []) {
    const k = s.group.join(",") || "*";
    const c = s.alias ?? s.formula;
    if (!cols.includes(c)) cols.push(c);
    const row = groups.get(k) ?? {};
    row[c] = reduceVals(s.pointlist, def.requests?.[0]?.queries?.[0]?.aggregator ?? "avg");
    groups.set(k, row);
  }
  const rows = [...groups].sort((a, b) => (b[1][cols[0]] ?? 0) - (a[1][cols[0]] ?? 0));
  return (
    <div className="h-full overflow-auto scroll-thin">
      <table className={tableStyles()}>
        <thead>
          <tr>
            <th>Group</th>
            {cols.map((c) => (
              <th key={c} className="!text-right">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, row]) => (
            <tr key={k}>
              <td className="truncate max-w-[240px]">{k}</td>
              {cols.map((c) => (
                <td key={c} className="text-right">
                  {fmtNum(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogStreamBody({ def }: { def: any }) {
  const { from, to, tick } = useTime();
  const query = def.requests?.[0]?.query?.query_string ?? def.query ?? "*";
  const q = useQuery({
    queryKey: ["ls", query, from, to, tick],
    queryFn: () => api<{ logs: any[] }>("/ui/logs/search", { body: { query, from, to, limit: 50 } }),
  });
  return (
    <div className="h-full overflow-auto scroll-thin text-xs">
      {(q.data?.logs ?? []).map((l) => (
        <div key={l.id} className="flex gap-2 py-0.5 border-b border-line/60">
          <span className="w-1 rounded" style={{ background: STATUS_COLORS[l.status] ?? "#5b7be0" }} />
          <span className="text-ink-3 w-16 shrink-0">{fmtTime(l.ts)}</span>
          <span className="text-primary w-24 truncate shrink-0">{l.service}</span>
          <span className="truncate">{l.message}</span>
        </div>
      ))}
    </div>
  );
}

function MonitorSummaryBody({ def }: { def: any }) {
  const q = useQuery({ queryKey: ["monitors"], queryFn: () => api<any[]>("/v1/monitor"), refetchInterval: 30_000 });
  const filter = String(def.query ?? "").toLowerCase();
  const mons = (q.data ?? []).filter(
    (m) => !filter || m.name.toLowerCase().includes(filter.replace(/^name:/, "")) || m.tags.some((t: string) => filter.includes(t)),
  );
  const counts = ["Alert", "Warn", "No Data", "OK"].map((s) => ({ s, n: mons.filter((m) => m.overall_state === s).length }));
  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex gap-2">
        {counts.map((c) => (
          <div key={c.s} className="flex-1 card p-2 text-center">
            <div className="text-xl font-semibold">{c.n}</div>
            <StatusBadge state={c.s} />
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-auto scroll-thin text-xs">
        {mons
          .filter((m) => m.overall_state !== "OK")
          .map((m) => (
            <Link key={m.id} href={`/monitors/${m.id}`} className="flex items-center gap-2 py-1 hover:bg-brand-100">
              <StatusBadge state={m.overall_state} />
              <span className="truncate">{m.name}</span>
            </Link>
          ))}
      </div>
    </div>
  );
}

export const WIDGET_TYPES: { type: string; label: string }[] = [
  { type: "timeseries", label: "Timeseries" },
  { type: "query_value", label: "Query Value" },
  { type: "toplist", label: "Top List" },
  { type: "query_table", label: "Table" },
  { type: "note", label: "Note" },
  { type: "group", label: "Group" },
  { type: "list_stream", label: "Log Stream" },
  { type: "manage_status", label: "Monitor Summary" },
];

export function WidgetBody({ def, vars }: { def: any; vars: Record<string, string> }) {
  switch (def.type) {
    case "timeseries":
      return <TimeseriesBody def={def} vars={vars} />;
    case "query_value":
      return <QueryValueBody def={def} vars={vars} />;
    case "toplist":
      return <TopListBody def={def} vars={vars} />;
    case "query_table":
      return <TableBody def={def} vars={vars} />;
    case "list_stream":
    case "log_stream":
      return <LogStreamBody def={def} />;
    case "manage_status":
      return <MonitorSummaryBody def={def} />;
    case "note":
    case "free_text":
      return (
        <div
          className="h-full overflow-auto text-[13px] whitespace-pre-wrap"
          style={{ textAlign: def.text_align ?? "left", background: def.background_color && def.background_color !== "white" ? "#fff8e1" : undefined }}
        >
          {def.content ?? def.text ?? ""}
        </div>
      );
    default:
      return <div className="text-ink-3 text-xs">Unsupported widget: {def.type}</div>;
  }
}

export function WidgetFrame({
  w,
  vars,
  editing,
  onEdit,
  onClone,
  onDelete,
  children,
}: {
  w: WidgetDef;
  vars: Record<string, string>;
  editing?: boolean;
  onEdit?: () => void;
  onClone?: () => void;
  onDelete?: () => void;
  children?: any;
}) {
  const def = w.definition;
  const [collapsed, setCollapsed] = useState(false);
  if (def.type === "group") {
    const color =
      {
        vivid_blue: "#2fa4e7",
        vivid_purple: "#6a4bd1",
        vivid_pink: "#c451c9",
        vivid_orange: "#e2733a",
        vivid_yellow: "#e8a317",
        vivid_green: "#2ca05a",
        blue: "#bde0fe",
        purple: "#ece8fb",
        pink: "#fde2f3",
        orange: "#ffe3d0",
        yellow: "#fff3c4",
        green: "#d9f2e1",
        gray: "#eef0f3",
        white: "#fff",
      }[def.background_color as string] ?? "#ece8fb";
    const vivid = String(def.background_color ?? "").startsWith("vivid");
    const tint = vivid ? `${color}22` : color;
    return (
      <div className="rounded-[4px] overflow-hidden h-full flex flex-col" style={{ background: tint }}>
        <div className="relative flex items-center justify-center gap-2 px-3 h-11 font-semibold text-[15px] text-ink group">
          <button className="absolute left-3 text-ink-2" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand group" : "Collapse group"}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
          <span className="truncate">{def.title}</span>
          {editing && (
            <span className="absolute right-3 flex gap-1">
              <button onClick={onEdit}>
                <Pencil size={13} />
              </button>
              <button onClick={onDelete}>
                <Trash2 size={13} />
              </button>
            </span>
          )}
        </div>
        {!collapsed && <div className="px-2 pb-2 flex-1">{children}</div>}
      </div>
    );
  }
  return (
    <div className={cardStyles({ className: "h-full flex flex-col group relative hover:border-line-strong" })} data-testid="widget">
      <div className="flex items-center gap-2 px-2.5 pt-2 pb-1 min-h-7">
        <div className="truncate flex-1" style={{ textAlign: def.title_align ?? "left" }}>
          {def.title ? (
            <span className="text-[13px] font-semibold text-ink underline decoration-dotted decoration-ink-3 underline-offset-[3px]">{def.title}</span>
          ) : (
            ""
          )}
        </div>
        <div className={`flex gap-1.5 text-ink-3 ${editing ? "" : "opacity-0 group-hover:opacity-100"}`}>
          {onEdit && (
            <button title="Edit" onClick={onEdit} className="hover:text-primary">
              <Pencil size={13} />
            </button>
          )}
          {onClone && (
            <button title="Clone" onClick={onClone} className="hover:text-primary">
              <Copy size={13} />
            </button>
          )}
          {onDelete && (
            <button title="Delete" onClick={onDelete} className="hover:text-alert">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 px-2 pb-2">
        <WidgetBody def={def} vars={vars} />
      </div>
    </div>
  );
}
