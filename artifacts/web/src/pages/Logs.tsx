import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Search, Radio, List, LineChart, BarChart3, Table2, Copy } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, CartesianGrid } from "recharts";
import { api } from "@/lib/api";
import { PageHeader, TABS } from "@/components/Layout";
import { TimePicker } from "@/components/TimePicker";
import { SidePanel, Facet, Empty } from "@/components/Panels";
import { TimeseriesChart } from "@/components/Chart";
import { useTime } from "@/lib/time";
import { fmtTime, fmtNum, STATUS_COLORS, colorFor } from "@/lib/format";
import { Button, Input, Select, badgeStyles, buttonStyles, cardStyles, labelStyles, tableStyles } from "@/components/ui";

export interface LogRow {
  id: string;
  ts: number;
  status: string;
  service: string;
  host: string;
  source: string;
  message: string;
  tags: string[];
  attributes: any;
  trace_id: string | null;
}

const STATUS_ORDER = ["emergency", "alert", "critical", "error", "warn", "notice", "info", "debug", "ok"];

function JsonTree({ data, prefix = "", onFilter }: { data: any; prefix?: string; onFilter: (k: string, v: string) => void }) {
  if (data === null || typeof data !== "object") return null;
  return (
    <div className="pl-3 border-l border-line">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="text-xs py-0.5">
          {v !== null && typeof v === "object" ? (
            <>
              <span className="text-primary font-medium">{k}</span>
              <JsonTree data={v} prefix={`${prefix}${k}.`} onFilter={onFilter} />
            </>
          ) : (
            <span className="group">
              <span className="text-primary">{k}</span>: <span className="mono">{String(v)}</span>
              <button className="ml-2 opacity-0 group-hover:opacity-100 text-primary" onClick={() => onFilter(`@${prefix}${k}`, String(v))}>
                filter
              </button>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function quoteVal(v: string) {
  return /[\s:()"]/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v;
}

export function LogsExplorer() {
  const params = new URLSearchParams(useSearch());
  const { from, to, tick } = useTime();
  const [query, setQuery] = useState(params.get("query") ?? "");
  const [input, setInput] = useState(params.get("query") ?? "");
  const [live, setLive] = useState(params.get("live") === "1");
  const [viz, setViz] = useState<"list" | "timeseries" | "toplist" | "table">((params.get("viz") as any) ?? "list");
  const [groupBy, setGroupBy] = useState("service");
  const [sel, setSel] = useState<LogRow | null>(null);
  const [liveRows, setLiveRows] = useState<LogRow[]>([]);
  const effFrom = live ? Math.floor(Date.now() / 1000) - 900 : from;
  const effTo = live ? Math.floor(Date.now() / 1000) + 5 : to;
  const list = useQuery({
    queryKey: ["logs", query, from, to, tick],
    queryFn: () => api<{ logs: LogRow[]; total: number; total_capped?: boolean }>("/ui/logs/search", { body: { query, from, to, limit: 200 } }),
    enabled: !live && viz === "list",
  });
  const hist = useQuery({
    queryKey: ["logs-hist", query, from, to, tick],
    queryFn: () => api<{ interval: number; buckets: { t: number; g: string; c: number }[] }>("/ui/logs/histogram", { body: { query, from, to } }),
    enabled: !live,
  });
  const facets = useQuery({
    queryKey: ["logs-facets", query, effFrom, effTo, tick],
    queryFn: () =>
      api<{ facets: Record<string, { value: string; count: number }[]> }>("/ui/logs/facets", {
        body: { query, from: effFrom, to: effTo, facets: ["status", "service", "host", "source", "env", "@http.status_code"] },
      }),
  });
  const agg = useQuery({
    queryKey: ["logs-agg", query, groupBy, viz, from, to, tick],
    queryFn: () => api<any>("/ui/logs/aggregate", { body: { query, groupBy, from, to, type: viz === "timeseries" ? "timeseries" : "toplist" } }),
    enabled: viz !== "list" && !live,
  });

  // live tail: poll for new logs every 2s
  useEffect(() => {
    if (!live) return;
    setLiveRows([]);
    // The position is the API cursor (time and id of the last log seen), so a burst of logs with one timestamp is read
    // page by page instead of repeating the first page. Requests from an older query are aborted and their results
    // dropped.
    const ctl = new AbortController();
    const since = Math.floor((Date.now() - 30_000) / 1000);
    let cursor: string | null = null;
    let busy = false;
    const poll = async () => {
      if (busy || ctl.signal.aborted) return;
      busy = true;
      try {
        for (let page = 0; page < 10 && !ctl.signal.aborted; page++) {
          const r: { logs: LogRow[]; cursor: string | null } | null = await api<{ logs: LogRow[]; cursor: string | null }>("/ui/logs/search", {
            body: { query, from: since, to: Math.floor(Date.now() / 1000) + 2, limit: 200, sort: "asc", ...(cursor ? { cursor } : {}) },
            signal: ctl.signal,
          }).catch(() => null);
          if (!r || ctl.signal.aborted) return;
          if (r.logs.length) {
            const last = r.logs[r.logs.length - 1];
            cursor = `${last.ts}_${last.id}`;
            setLiveRows((rows) => {
              const ids = new Set(rows.map((x) => x.id));
              return [...r.logs.filter((l) => !ids.has(l.id)).reverse(), ...rows].slice(0, 500);
            });
          }
          if (!r.cursor) break;
        }
      } finally {
        busy = false;
      }
    };
    poll();
    const iv = setInterval(poll, 2000);
    return () => {
      clearInterval(iv);
      ctl.abort();
    };
  }, [live, query]);

  const histData = useMemo(() => {
    const m = new Map<number, any>();
    for (const b of hist.data?.buckets ?? []) {
      const r = m.get(b.t) ?? { t: b.t };
      r[b.g] = (r[b.g] ?? 0) + b.c;
      m.set(b.t, r);
    }
    return [...m.values()].sort((a, b) => a.t - b.t);
  }, [hist.data]);
  const histKeys = [...new Set((hist.data?.buckets ?? []).map((b) => b.g))].sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b));

  const selectedFacet = (key: string) => {
    const re = new RegExp(`(^|\\s)${key.replace(/[.@]/g, "\\$&")}:("[^"]*"|\\S+)`, "g");
    return [...query.matchAll(re)].map((m) => m[2].replace(/^"|"$/g, ""));
  };
  const toggleFacet = (key: string, v: string) => {
    const token = `${key}:${quoteVal(v)}`;
    let q = query;
    if (selectedFacet(key).includes(v)) q = q.replace(token, "").replace(/\s+/g, " ").trim();
    else q = `${q} ${token}`.trim();
    setQuery(q);
    setInput(q);
  };
  const addFilter = (k: string, v: string) => {
    const q = `${query} ${k}:${quoteVal(v)}`.trim();
    setQuery(q);
    setInput(q);
    setSel(null);
  };
  const rows = live ? liveRows : (list.data?.logs ?? []);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Logs"
        tabs={TABS.logs}
        sub={live ? "Live Tail" : list.data ? `${fmtNum(list.data.total)}${list.data.total_capped ? "+" : ""} logs found` : undefined}
      >
        <button className={buttonStyles({ variant: live ? "primary" : "secondary" })} onClick={() => setLive(!live)} data-testid="live-tail">
          <Radio size={14} /> {live ? "Live Tail on" : "Live Tail"}
        </button>
        {!live && <TimePicker />}
      </PageHeader>
      <div className="px-6 py-3 border-b border-line flex gap-2 items-center">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(input);
          }}
        >
          <Search size={14} className="absolute left-2.5 top-2.5 text-ink-3" />
          <Input
            className="w-full pl-8 text-[13px]"
            placeholder='Search for logs, e.g. service:web status:error @http.status_code:>=500 "timeout"'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            data-testid="log-search"
          />
        </form>
        <div className="flex">
          {(
            [
              ["list", List, "List"],
              ["timeseries", LineChart, "Timeseries"],
              ["toplist", BarChart3, "Top List"],
              ["table", Table2, "Table"],
            ] as const
          ).map(([v, Icon, label]) => (
            <button
              key={v}
              title={label}
              onClick={() => {
                setViz(v);
                if (v !== "list") setLive(false);
              }}
              className={`h-[30px] px-2.5 border border-line-strong -ml-px first:rounded-l-[3px] last:rounded-r-[3px] flex items-center gap-1 text-xs ${viz === v ? "bg-brand-100 text-primary font-semibold border-primary z-10" : "bg-white text-ink-2"}`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
        {viz !== "list" && (
          <label className="text-xs flex items-center gap-1">
            by{" "}
            <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
              {["", "service", "status", "host", "source", "env", "@http.status_code"].map((g) => (
                <option key={g} value={g}>
                  {g || "(everything)"}
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>
      {!live && (
        <div className="h-24 px-6 pt-2 border-b border-line">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histData} margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
              <CartesianGrid stroke="#eceef2" vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={(t) => fmtTime(t).slice(0, 5)}
                tick={{ fontSize: 10, fill: "#7d8b96" }}
                axisLine={false}
                tickLine={false}
                minTickGap={50}
              />
              <Tooltip labelFormatter={(t) => fmtTime(Number(t), true)} contentStyle={{ fontSize: 11 }} />
              {histKeys.map((k) => (
                <Bar key={k} dataKey={k} stackId="a" fill={STATUS_COLORS[k] ?? "#5b7be0"} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        <aside className="w-64 border-r border-line overflow-auto scroll-thin bg-white">
          {Object.entries({ status: "Status", service: "Service", host: "Host", source: "Source", env: "Env", "@http.status_code": "Status Code" }).map(
            ([k, t]) => (
              <Facet key={k} title={t} values={facets.data?.facets[k] ?? []} selected={selectedFacet(k)} onToggle={(v) => toggleFacet(k, v)} />
            ),
          )}
        </aside>
        <div className="flex-1 overflow-auto scroll-thin">
          {viz === "list" || live ? (
            rows.length === 0 && !list.isLoading ? (
              <Empty title={live ? "Waiting for new logs…" : "No logs match this query"}>
                {live ? (
                  "New logs that match appear here as they arrive."
                ) : (
                  <>
                    Send logs with the agent or the HTTP intake.{" "}
                    <Link className="text-primary" href="/account/agent">
                      Set up log collection →
                    </Link>
                  </>
                )}
              </Empty>
            ) : (
              <table className={tableStyles()}>
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="w-2 !px-0"></th>
                    <th className="w-40">Date</th>
                    <th className="w-36">Host</th>
                    <th className="w-32">Service</th>
                    <th>Content</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr
                      key={l.id}
                      className={`cursor-pointer [&>td]:!h-[28px] ${sel?.id === l.id ? "!bg-brand-100" : ""}`}
                      onClick={() => setSel(l)}
                      data-testid="log-row"
                    >
                      <td className="!px-0">
                        <div className="w-[3px] h-[28px]" style={{ background: STATUS_COLORS[l.status] ?? "#5b7be0" }} />
                      </td>
                      <td className="text-ink-2 whitespace-nowrap text-[12px]">{fmtTime(l.ts, true)}</td>
                      <td className="truncate max-w-[140px] text-[12px] text-ink-2">{l.host}</td>
                      <td
                        className="truncate max-w-[130px] text-[12px] font-medium"
                        style={{ color: STATUS_COLORS[l.status] === undefined ? undefined : undefined }}
                      >
                        {l.service}
                      </td>
                      <td className="text-[12px] truncate max-w-0 w-full">
                        <span className={l.status === "error" ? "text-alert" : ""}>{l.message}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : viz === "timeseries" ? (
            <div className="p-6">
              <div className={cardStyles({ className: "p-3" })}>
                <TimeseriesChart
                  series={(agg.data?.series ?? []).map((s: any) => ({ label: s.group.join(",") || "count", points: s.pointlist }))}
                  type="bars"
                  stacked
                  height={360}
                  from={from}
                  to={to}
                  showLegend
                />
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className={cardStyles({ className: "p-3" })}>
                {(agg.data?.rows ?? []).map((r: any, i: number) => {
                  const max = Math.max(...(agg.data?.rows ?? []).map((x: any) => x.value), 1);
                  return viz === "toplist" ? (
                    <div key={r.group} className="flex items-center gap-2 py-1 text-xs">
                      <div className="w-48 truncate text-right">{r.group}</div>
                      <div className="flex-1 h-5 bg-panel rounded">
                        <div className="h-full rounded" style={{ width: `${(r.value / max) * 100}%`, background: colorFor(i) }} />
                      </div>
                      <div className="w-14 text-right font-semibold">{fmtNum(r.value)}</div>
                    </div>
                  ) : (
                    <div key={r.group} className="flex py-1 text-xs border-b border-line">
                      <div className="flex-1">{r.group}</div>
                      <div className="w-24 text-right">{fmtNum(r.value)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <SidePanel
        open={!!sel}
        onClose={() => setSel(null)}
        title={
          sel ? (
            <span className="flex items-center gap-2">
              <span className="px-1.5 rounded text-white text-[11px] uppercase font-bold" style={{ background: STATUS_COLORS[sel.status] }}>
                {sel.status}
              </span>
              {fmtTime(sel.ts, true)}
            </span>
          ) : (
            ""
          )
        }
        width={720}
      >
        {sel && (
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap gap-4 text-xs">
              {(["host", "service", "source"] as const).map((k) => (
                <div key={k}>
                  <div className={labelStyles()}>{k}</div>
                  <button className="text-primary hover:underline" onClick={() => addFilter(k, sel[k])}>
                    {sel[k] || "—"}
                  </button>
                </div>
              ))}
              {sel.trace_id && (
                <div>
                  <div className={labelStyles()}>Trace</div>
                  <Link className="text-primary hover:underline" href={`/apm/trace/${sel.trace_id}`}>
                    View trace →
                  </Link>
                </div>
              )}
            </div>
            <div className="relative">
              <pre className="mono text-xs bg-panel border border-line rounded p-3 whitespace-pre-wrap break-all" data-testid="log-message">
                {sel.message}
              </pre>
              <button className="absolute top-2 right-2 text-ink-3" onClick={() => navigator.clipboard.writeText(sel.message)}>
                <Copy size={13} />
              </button>
            </div>
            <div>
              <div className={labelStyles({ className: "mb-1" })}>Tags</div>
              <div className="flex flex-wrap gap-1">
                {sel.tags.map((t) => (
                  <button
                    key={t}
                    className={badgeStyles({ className: "hover:bg-brand-100" })}
                    onClick={() => {
                      const i = t.indexOf(":");
                      if (i > 0) addFilter(t.slice(0, i), t.slice(i + 1));
                    }}
                  >
                    {t}
                  </button>
                ))}
                {!sel.tags.length && <span className="text-xs text-ink-3">none</span>}
              </div>
            </div>
            <div>
              <div className={labelStyles({ className: "mb-1" })}>Event attributes</div>
              <JsonTree data={sel.attributes} onFilter={addFilter} />
            </div>
            <Button
              onClick={() => {
                const q = `host:${sel.host}`;
                setQuery(q);
                setInput(q);
                setSel(null);
              }}
            >
              View in context (same host)
            </Button>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
