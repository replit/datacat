import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Search, Map as MapIcon, List } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader, TABS } from "@/components/Layout";
import { SidePanel, Empty } from "@/components/Panels";
import { TimeseriesChart } from "@/components/Chart";
import { useTime, TimeProvider } from "@/lib/time";
import { TimePicker } from "@/components/TimePicker";
import { fmtAgo, fmtNum, fmtPct, fmtTime, STATUS_COLORS, fmtDuration } from "@/lib/format";
import { Input, Select, badgeStyles, cardStyles, labelStyles, tableStyles } from "@/components/ui";

export interface Host {
  id: number;
  name: string;
  os: string | null;
  platform: string | null;
  agent_version: string | null;
  tags: string[];
  apps: string[];
  services: string[];
  up: boolean;
  last_seen: number;
  cpu: number | null;
  iowait: number | null;
  load15: number | null;
  load1: number | null;
  mem_pct: number | null;
  disk_pct: number | null;
  meta: any;
}

function InfraTabs() {
  const [loc] = useLocation();
  return (
    <div className="flex gap-0 border-b border-line px-6 bg-white">
      {[
        ["/infrastructure", "Infrastructure List", List],
        ["/infrastructure/map", "Host Map", MapIcon],
      ].map(([href, label, Icon]: any) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-1.5 px-3 h-10 border-b-2 text-[13px] font-medium ${loc === href ? "border-primary text-primary" : "border-transparent text-ink-2 hover:text-ink"}`}
        >
          <Icon size={14} />
          {label}
        </Link>
      ))}
    </div>
  );
}

function HostCharts({ host }: { host: string }) {
  const { from, to, tick } = useTime();
  const q = useQuery({
    queryKey: ["host-charts", host, from, to, tick],
    queryFn: async () => {
      const qs = [
        [
          "CPU usage (%)",
          [
            { name: "a", query: `avg:system.cpu.user{host:${host}}` },
            { name: "b", query: `avg:system.cpu.system{host:${host}}` },
            { name: "c", query: `avg:system.cpu.iowait{host:${host}}` },
          ],
          ["user", "system", "iowait"],
        ],
        [
          "Load averages",
          [
            { name: "a", query: `avg:system.load.1{host:${host}}` },
            { name: "b", query: `avg:system.load.5{host:${host}}` },
            { name: "c", query: `avg:system.load.15{host:${host}}` },
          ],
          ["1m", "5m", "15m"],
        ],
        ["Available memory", [{ name: "a", query: `avg:system.mem.usable{host:${host}}` }], ["usable"]],
        [
          "Network traffic (bytes/s)",
          [
            { name: "a", query: `sum:system.net.bytes_rcvd{host:${host}}` },
            { name: "b", query: `sum:system.net.bytes_sent{host:${host}}` },
          ],
          ["received", "sent"],
        ],
        ["Disk usage (%)", [{ name: "a", query: `max:system.disk.in_use{host:${host}} by {device}` }], ["in use"]],
      ] as const;
      const out = [];
      for (const [title, queries, labels] of qs) {
        const r = await api<{ series: any[] }>("/ui/metrics/query", { body: { queries, from, to } });
        out.push({
          title,
          series: r.series.map((s, i) => ({
            label: s.group.length ? s.group.join(",") : (labels[queries.findIndex((q: any) => q.name === s.name)] ?? labels[i] ?? s.name),
            points: title === "Disk usage (%)" ? s.pointlist.map((p: any) => [p[0], p[1] * 100]) : s.pointlist,
          })),
        });
      }
      return out;
    },
  });
  return (
    <div className="grid grid-cols-2 gap-3">
      {(q.data ?? []).map((c) => (
        <div key={c.title} className={cardStyles({ className: "p-2" })}>
          <div className="text-xs font-medium mb-1">{c.title}</div>
          <TimeseriesChart series={c.series} height={130} type={c.title.startsWith("CPU") ? "area" : "line"} from={from} to={to} />
        </div>
      ))}
    </div>
  );
}

function HostLogsAndTraces({ host }: { host: string }) {
  const { from, to } = useTime();
  const logs = useQuery({
    queryKey: ["host-logs", host, from, to],
    queryFn: () => api<{ logs: any[] }>("/ui/logs/search", { body: { query: `host:${host}`, from, to, limit: 15 } }),
  });
  const spans = useQuery({
    queryKey: ["host-spans", host, from, to],
    queryFn: () => api<{ spans: any[] }>("/ui/apm/spans", { body: { query: `host:${host}`, from, to, limit: 15, topLevelOnly: true } }),
  });
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className={cardStyles()}>
        <div className="flex items-center px-3 py-2 border-b border-line text-xs font-semibold">
          Logs{" "}
          <Link className="ml-auto text-primary font-normal" href={`/logs?query=${encodeURIComponent(`host:${host}`)}`}>
            Open in Log Explorer →
          </Link>
        </div>
        {(logs.data?.logs ?? []).map((l) => (
          <div key={l.id} className="flex gap-2 px-3 py-1 text-xs border-b border-line/60">
            <span className="w-1 rounded" style={{ background: STATUS_COLORS[l.status] }} />
            <span className="text-ink-3 w-16">{fmtTime(l.ts)}</span>
            <span className="text-primary w-20 truncate">{l.service}</span>
            <span className="truncate">{l.message}</span>
          </div>
        ))}
        {!logs.data?.logs.length && <div className="px-3 py-2 text-xs text-ink-3">No logs from this host in this time range</div>}
      </div>
      <div className={cardStyles()}>
        <div className="flex items-center px-3 py-2 border-b border-line text-xs font-semibold">
          Traces{" "}
          <Link className="ml-auto text-primary font-normal" href={`/apm/traces?query=${encodeURIComponent(`host:${host}`)}`}>
            Open in Trace Explorer →
          </Link>
        </div>
        {(spans.data?.spans ?? []).map((s) => (
          <Link key={s.id} href={`/apm/trace/${s.trace_id}`} className="flex gap-2 px-3 py-1 text-xs border-b border-line/60 hover:bg-brand-100">
            <span className="text-ink-3 w-16">{fmtTime(s.start_ms)}</span>
            <span className="text-primary w-24 truncate">{s.service}</span>
            <span className="truncate flex-1">{s.resource}</span>
            <span>{fmtDuration(s.duration)}</span>
          </Link>
        ))}
        {!spans.data?.spans.length && <div className="px-3 py-2 text-xs text-ink-3">No traces from this host in this time range</div>}
      </div>
    </div>
  );
}

export function HostPanel({ host, onClose }: { host: Host | null; onClose: () => void }) {
  const [tab, setTab] = useState("metrics");
  if (!host) return null;
  return (
    <SidePanel
      open
      onClose={onClose}
      width={860}
      title={
        <span className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${host.up ? "bg-ok" : "bg-nodata"}`} />
          {host.name}
        </span>
      }
    >
      <TimeProvider>
        <div className="px-5 py-3 border-b border-line flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <div>
            <span className="text-ink-3">OS</span> {host.os ?? "—"} {host.platform ? `(${host.platform})` : ""}
          </div>
          <div>
            <span className="text-ink-3">Agent</span> {host.agent_version ?? "—"}
          </div>
          <div>
            <span className="text-ink-3">CPU cores</span> {host.meta?.cpuCores ?? "—"}
          </div>
          <div>
            <span className="text-ink-3">Last reported</span> {fmtAgo(host.last_seen * 1000)}
          </div>
          <div className="w-full flex flex-wrap gap-1 pt-1">
            {host.tags.map((t) => (
              <span key={t} className={badgeStyles()}>
                {t}
              </span>
            ))}
            {host.apps.map((a) => (
              <span key={a} className={badgeStyles({ tone: "brand" })}>
                {a}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 px-5 pt-2 border-b border-line">
          {["metrics", "logs & traces"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 h-9 border-b-2 capitalize ${tab === t ? "border-primary text-primary font-semibold" : "border-transparent text-ink-2"}`}
            >
              {t}
            </button>
          ))}
          <div className="ml-auto pb-1">
            <TimePicker />
          </div>
        </div>
        <div className="p-4">{tab === "metrics" ? <HostCharts host={host.name} /> : <HostLogsAndTraces host={host.name} />}</div>
      </TimeProvider>
    </SidePanel>
  );
}

export function InfraList() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Host | null>(null);
  const [sort, setSort] = useState<{ k: keyof Host; dir: 1 | -1 }>({ k: "name", dir: 1 });
  const hosts = useQuery({ queryKey: ["hosts"], queryFn: () => api<{ hosts: Host[] }>("/ui/hosts"), refetchInterval: 30_000 });
  const rows = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const r = (hosts.data?.hosts ?? []).filter((h) =>
      terms.every((t) => h.name.toLowerCase().includes(t) || h.tags.some((x) => x.toLowerCase().includes(t)) || h.apps.some((x) => x.includes(t))),
    );
    return r.sort((a: any, b: any) => ((a[sort.k] ?? -1) > (b[sort.k] ?? -1) ? 1 : -1) * sort.dir);
  }, [hosts.data, q, sort]);
  const th = (k: keyof Host, label: string, right = false) => (
    <th className={`cursor-pointer ${right ? "!text-right" : ""}`} onClick={() => setSort({ k, dir: sort.k === k ? (-sort.dir as 1 | -1) : 1 })}>
      {label}
      {sort.k === k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );
  return (
    <div>
      <PageHeader title="Infrastructure" tabs={TABS.infra} sub={`${rows.length} hosts`} />
      <div className="p-6">
        <div className="relative mb-3 max-w-xl">
          <Search size={14} className="absolute left-2.5 top-2.5 text-ink-3" />
          <Input
            className="w-full pl-8"
            placeholder="Filter hosts by name, tag or app"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="host-filter"
          />
        </div>
        {rows.length === 0 && !hosts.isLoading ? (
          <Empty title="No hosts reporting">
            Install the agent on a host to see it here.{" "}
            <Link href="/account/agent" className="text-primary">
              Installation instructions →
            </Link>
          </Empty>
        ) : (
          <table className={tableStyles({ className: "bg-white border border-line rounded-lg" })}>
            <thead>
              <tr>
                {th("name", "Hostname")}
                <th>Status</th>
                {th("cpu", "CPU", true)}
                {th("iowait", "IOWait", true)}
                {th("load15", "Load 15", true)}
                {th("mem_pct", "Memory", true)}
                <th>Apps</th>
                {th("os", "OS")}
                {th("agent_version", "Agent")}
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id} className="cursor-pointer" onClick={() => setSel(h)} data-testid="host-row">
                  <td className="font-medium text-primary">{h.name}</td>
                  <td>
                    <span className={`inline-flex items-center gap-1 text-xs ${h.up ? "text-ok" : "text-ink-3"}`}>
                      <span className={`w-2 h-2 rounded-full ${h.up ? "bg-ok" : "bg-nodata"}`} />
                      {h.up ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td className="text-right">{fmtPct(h.cpu)}</td>
                  <td className="text-right">{fmtPct(h.iowait)}</td>
                  <td className="text-right">{fmtNum(h.load15)}</td>
                  <td className="text-right">{fmtPct(h.mem_pct)}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {h.apps.slice(0, 6).map((a) => (
                        <span key={a} className={badgeStyles({ tone: "brand" })}>
                          {a}
                        </span>
                      ))}
                      {h.apps.length > 6 && <span className={badgeStyles()}>+{h.apps.length - 6}</span>}
                    </div>
                  </td>
                  <td className="text-ink-2">{h.os ?? "—"}</td>
                  <td className="text-ink-2">{h.agent_version ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <HostPanel host={sel} onClose={() => setSel(null)} />
    </div>
  );
}

const FILL_METRICS = [
  { label: "CPU utilized %", value: "cpu" },
  { label: "system.load.15", value: "avg:system.load.15{*}" },
  { label: "Memory used %", value: "mem" },
  { label: "IOWait %", value: "avg:system.cpu.iowait{*}" },
  { label: "Disk in use", value: "avg:system.disk.in_use{*}" },
];

function colorScale(v: number | null | undefined, min: number, max: number) {
  if (v === null || v === undefined || Number.isNaN(v)) return "#d7dbe1";
  const t = max > min ? Math.min(1, Math.max(0, (v - min) / (max - min))) : 0;
  const stops = [
    [44, 160, 90],
    [140, 196, 74],
    [232, 196, 23],
    [242, 140, 40],
    [211, 59, 76],
  ];
  const i = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
  const f = t * (stops.length - 1) - i;
  const c = stops[i].map((x, k) => Math.round(x + (stops[i + 1][k] - x) * f));
  return `rgb(${c.join(",")})`;
}

function Hex({ x, y, r, fill, onClick, title, selected }: any) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${x + r * Math.cos(a)},${y + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <polygon
      points={pts}
      fill={fill}
      stroke={selected ? "#1d1438" : "#fff"}
      strokeWidth={selected ? 2.5 : 1.5}
      onClick={onClick}
      className="cursor-pointer hover:opacity-80"
      data-testid="hex"
    >
      <title>{title}</title>
    </polygon>
  );
}

export function HostMap() {
  const [fill, setFill] = useState("cpu");
  const [filter, setFilter] = useState("");
  const [groupBy, setGroupBy] = useState("");
  const [sel, setSel] = useState<Host | null>(null);
  const metricQ = fill === "cpu" || fill === "mem" ? null : fill;
  const data = useQuery({
    queryKey: ["hostmap", fill],
    queryFn: () =>
      metricQ
        ? api<{ values: Record<string, number>; hosts: Host[] }>("/ui/hostmap", { body: { metric: metricQ } })
        : api<{ hosts: Host[] }>("/ui/hosts").then((r) => ({ ...r, values: {} as Record<string, number> })),
    refetchInterval: 30_000,
  });
  const hosts = (data.data?.hosts ?? []).filter(
    (h) =>
      !filter ||
      filter
        .split(/[\s,]+/)
        .filter(Boolean)
        .every((f) => h.name.includes(f) || h.tags.includes(f) || h.apps.includes(f)),
  );
  const valueOf = (h: Host) => (fill === "cpu" ? h.cpu : fill === "mem" ? h.mem_pct : (data.data?.values[h.name] ?? null));
  const vals = hosts.map(valueOf).filter((v): v is number => v !== null && v !== undefined);
  const min = fill === "cpu" || fill === "mem" ? 0 : Math.min(...vals, 0),
    max = fill === "cpu" || fill === "mem" ? 100 : Math.max(...vals, 1);
  const groups = useMemo(() => {
    const g = new Map<string, Host[]>();
    for (const h of hosts) {
      const key = groupBy ? (h.tags.find((t) => t.startsWith(groupBy + ":"))?.slice(groupBy.length + 1) ?? `no ${groupBy}`) : "all";
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(h);
    }
    return [...g].sort((a, b) => a[0].localeCompare(b[0]));
  }, [hosts, groupBy]);
  const tagKeys = useMemo(() => [...new Set((data.data?.hosts ?? []).flatMap((h) => h.tags.map((t) => t.split(":")[0])))].sort(), [data.data]);
  const R = 26;
  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Infrastructure" tabs={TABS.infra} sub={`${hosts.length} hosts`} />
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-line bg-panel">
        <label className="flex items-center gap-2 text-xs">
          <span className={labelStyles()}>Fill by</span>
          <Select value={fill} onChange={(e) => setFill(e.target.value)} data-testid="fill-by">
            {FILL_METRICS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-2 text-xs">
          <span className={labelStyles()}>Filter by</span>
          <Input className="w-64" placeholder="tag or hostname" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <span className={labelStyles()}>Group by</span>
          <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="">(none)</option>
            {tagKeys.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </Select>
        </label>
        <div className="ml-auto flex items-center gap-2 text-xs text-ink-2">
          <span>{fmtNum(min)}</span>
          <div
            className="w-40 h-2.5 rounded"
            style={{ background: "linear-gradient(90deg, rgb(44,160,90), rgb(140,196,74), rgb(232,196,23), rgb(242,140,40), rgb(211,59,76))" }}
          />
          <span>{fmtNum(max)}</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 bg-subtle">
        {hosts.length === 0 && !data.isLoading && <Empty title="No hosts match">Adjust the filter, or install the agent on a host.</Empty>}
        <div className="flex flex-wrap gap-6">
          {groups.map(([g, hs]) => {
            const cols = Math.max(1, Math.ceil(Math.sqrt(hs.length * 1.6)));
            const rows = Math.ceil(hs.length / cols);
            const w = cols * R * Math.sqrt(3) + R,
              hgt = rows * R * 1.5 + R;
            return (
              <div key={g} className={cardStyles({ className: "p-3" })}>
                {groupBy && (
                  <div className="text-xs font-semibold mb-1">
                    {groupBy}:{g} <span className="text-ink-3 font-normal">({hs.length})</span>
                  </div>
                )}
                <svg width={w + 4} height={hgt + 4}>
                  {hs.map((h, i) => {
                    const r = Math.floor(i / cols),
                      c = i % cols;
                    const x = R + c * R * Math.sqrt(3) + (r % 2 ? (R * Math.sqrt(3)) / 2 : 0);
                    const y = R + r * R * 1.5;
                    const v = valueOf(h);
                    return (
                      <Hex
                        key={h.id}
                        x={x}
                        y={y}
                        r={R - 1}
                        fill={h.up ? colorScale(v, min, max) : "#c3c7cf"}
                        selected={sel?.id === h.id}
                        onClick={() => setSel(h)}
                        title={`${h.name}\n${FILL_METRICS.find((m) => m.value === fill)?.label}: ${fmtNum(v)}`}
                      />
                    );
                  })}
                </svg>
              </div>
            );
          })}
        </div>
      </div>
      <HostPanel host={sel} onClose={() => setSel(null)} />
    </div>
  );
}
