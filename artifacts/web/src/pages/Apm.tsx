import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearch, useLocation } from "wouter";
import { Search, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader, TABS } from "@/components/Layout";
import { useAuthUser } from "@/lib/auth";
import { TimePicker } from "@/components/TimePicker";
import { TimeseriesChart } from "@/components/Chart";
import { Facet, Empty, SidePanel } from "@/components/Panels";
import { useTime } from "@/lib/time";
import { fmtDuration, fmtNum, fmtPct, fmtTime, colorFor, STATUS_COLORS } from "@/lib/format";
import { Input, Select, badgeStyles, buttonStyles, cardStyles, labelStyles, sectionTitleStyles, tableStyles } from "@/components/ui";

interface Svc {
  service: string;
  type: string;
  envs: string[];
  language: string | null;
  hits: number;
  errors: number;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  total: number;
  rps: number;
  error_rate: number;
}
interface Span {
  id: string;
  trace_id: string;
  span_id: string;
  parent_id: string;
  service: string;
  name: string;
  resource: string;
  type: string;
  env: string;
  host: string;
  start: number;
  start_ms: number;
  duration: number;
  error: number;
  meta: Record<string, string>;
  metrics?: Record<string, number>;
}

const svcColor = (() => {
  const m = new Map<string, string>();
  return (s: string) => {
    if (!m.has(s)) m.set(s, colorFor(m.size));
    return m.get(s)!;
  };
})();

function ApmTabs() {
  const [loc] = useLocation();
  return (
    <div className="flex border-b border-line px-6 bg-white">
      {[
        ["/apm/services", "Service Catalog"],
        ["/apm/traces", "Traces"],
      ].map(([h, l]) => (
        <Link
          key={h}
          href={h}
          className={`px-3 h-10 flex items-center border-b-2 text-[13px] font-medium ${loc.startsWith(h) ? "border-primary text-primary" : "border-transparent text-ink-2"}`}
        >
          {l}
        </Link>
      ))}
    </div>
  );
}

export function ApmServices() {
  const { from, to, tick } = useTime();
  const [env, setEnv] = useState("*");
  const [q, setQ] = useState("");
  const data = useQuery({
    queryKey: ["apm-services", env, from, to, tick],
    queryFn: () => api<{ services: Svc[]; envs: string[] }>(`/ui/apm/services?env=${encodeURIComponent(env)}&from=${from}&to=${to}`),
  });
  const { user } = useAuthUser();
  const mons = useQuery({ queryKey: ["monitors"], queryFn: () => api<any[]>("/v1/monitor"), refetchInterval: 30_000 });
  const svcs = data.data?.services ?? [];
  const rows = svcs.filter((s) => s.service.toLowerCase().includes(q.toLowerCase()));
  const attention: { level: "HIGH" | "MEDIUM" | "LOW"; kind: string; title: any; svc?: string; foot: string; href: string }[] = [];
  const worst = [...svcs].filter((s) => s.error_rate > 0.01).sort((a, b) => b.error_rate - a.error_rate)[0];
  if (worst)
    attention.push({
      level: worst.error_rate > 0.1 ? "HIGH" : "MEDIUM",
      kind: "Error rate",
      title: (
        <>
          Elevated error rate on <span className="mono text-primary">{worst.service}</span>: {fmtPct(worst.error_rate * 100, 1)} of requests failed.
        </>
      ),
      svc: worst.service,
      foot: `${fmtNum(worst.errors)} errors · ${fmtNum(worst.hits)} requests`,
      href: `/apm/services/${encodeURIComponent(worst.service)}`,
    });
  const slow = [...svcs].sort((a, b) => b.p95 - a.p95)[0];
  if (slow && slow !== worst)
    attention.push({
      level: "LOW",
      kind: "Latency",
      title: (
        <>
          Slowest service is <span className="mono text-primary">{slow.service}</span> with P95 latency {fmtDuration(slow.p95)}.
        </>
      ),
      svc: slow.service,
      foot: `P99 ${fmtDuration(slow.p99)}`,
      href: `/apm/services/${encodeURIComponent(slow.service)}`,
    });
  const alerting = (mons.data ?? []).filter((m) => m.overall_state === "Alert");
  return (
    <div className="min-h-full">
      <PageHeader title="APM" tabs={TABS.apm}>
        <TimePicker />
      </PageHeader>
      <div className="px-6 py-6">
        <div className="flex items-start mb-5">
          <div>
            <h2 className="text-[24px] font-semibold">Welcome to APM{user?.firstName ? `, ${user.firstName}` : ""}</h2>
            <div className="text-ink-2 text-[13px] mt-0.5">Get a real-time view of your system's services, dependencies, and performance.</div>
          </div>
          <Link href="/docs/getting-started" className={buttonStyles({ className: "ml-auto" })}>
            <Plus size={14} /> Instrument a Service
          </Link>
        </div>
        <h3 className="text-[16px] font-semibold mb-2">What needs your attention</h3>
        <div className="grid grid-cols-3 gap-3 mb-7">
          {attention.map((a, i) => (
            <Link key={i} href={a.href} className={cardStyles({ className: "p-3.5 flex flex-col gap-2 hover:border-brand-400 min-h-[132px]" })}>
              <div className="flex items-center text-[11px] font-semibold text-ink-2 uppercase tracking-wide">
                <span>{a.kind}</span>
                <span
                  className={`ml-auto px-1.5 rounded-[3px] text-[10px] ${a.level === "HIGH" ? "bg-alert/10 text-alert" : a.level === "MEDIUM" ? "bg-warn/15 text-amber-800" : "bg-subtle text-ink-2"}`}
                >
                  {a.level}
                </span>
              </div>
              <div className="text-[14px] leading-snug flex-1">{a.title}</div>
              <div className="flex gap-2 text-[11px]">
                <span className={badgeStyles()}>
                  <span className="w-2 h-2 rounded-sm" style={{ background: svcColor(a.svc ?? "") }} />
                  {a.svc}
                </span>
                <span className={badgeStyles()}>{a.foot}</span>
              </div>
            </Link>
          ))}
          <Link
            href="/monitors/manage?status=Alert"
            className="rounded-lg p-3.5 bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200 flex flex-col min-h-[132px]"
          >
            <div className="text-[18px] font-semibold leading-tight">
              {alerting.length ? `${alerting.length} monitor${alerting.length > 1 ? "s" : ""} alerting` : "All monitors OK"}
            </div>
            <div className="text-[12px] text-ink-2 mt-1 flex-1">
              {alerting
                .slice(0, 3)
                .map((m) => m.name)
                .join(" · ") || "Nothing is triggered right now."}
            </div>
            <span className="text-primary text-[13px] font-medium">View monitors →</span>
          </Link>
        </div>
        <h3 className="text-[16px] font-semibold mb-2">Your system at a glance</h3>
        <div className={cardStyles()}>
          <div className="flex justify-center border-b border-line">
            <span className="px-8 h-10 flex items-center gap-2 text-[13px] font-semibold border-b-2 border-primary -mb-px">Services</span>
            <Link href="/apm/traces" className="px-8 h-10 flex items-center text-[13px] text-ink-2 hover:text-ink">
              Traces
            </Link>
          </div>
          <div className="px-4 pt-3 pb-1 flex items-center">
            <span className="text-[14px] font-semibold">Service List</span>
            <span className="ml-auto text-[12px] text-ink-3">{rows.length} services</span>
          </div>
          <div className="flex gap-2 px-4 py-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-2 text-ink-3" />
              <Input className="w-full pl-8" placeholder="Search services" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select className="w-36" value={env} onChange={(e) => setEnv(e.target.value)} aria-label="env">
              <option value="*">env:*</option>
              {data.data?.envs.map((e) => (
                <option key={e} value={e}>
                  env:{e}
                </option>
              ))}
            </Select>
          </div>
          {rows.length === 0 && !data.isLoading ? (
            <Empty title="No services reporting">
              Add tracing to your app with @datacat/trace (Node.js) or datacat-trace (Python).{" "}
              <Link className="text-primary" href="/docs/getting-started">
                Follow the guide →
              </Link>
            </Empty>
          ) : (
            <table className={tableStyles()}>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Type</th>
                  <th>Env</th>
                  <th className="!text-right">Requests</th>
                  <th className="!text-right">Req/s</th>
                  <th className="!text-right">Error rate</th>
                  <th className="!text-right">P50</th>
                  <th className="!text-right">P95 latency</th>
                  <th className="!text-right">P99</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.service} data-testid="service-row">
                    <td>
                      <Link
                        href={`/apm/services/${encodeURIComponent(s.service)}`}
                        className="flex items-center gap-2 text-ink hover:text-primary hover:underline font-medium"
                      >
                        <span
                          className="w-[18px] h-[18px] rounded-[4px] flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ background: svcColor(s.service) }}
                        >
                          {s.service[0]?.toUpperCase()}
                        </span>
                        {s.service}
                      </Link>
                    </td>
                    <td className="text-ink-2">
                      {s.type || "custom"}
                      {s.language ? ` · ${s.language}` : ""}
                    </td>
                    <td className="text-ink-2">{s.envs.filter(Boolean).join(", ") || "—"}</td>
                    <td className="text-right">{fmtNum(s.hits)}</td>
                    <td className="text-right">{fmtNum(s.rps)}</td>
                    <td className={`text-right ${s.error_rate > 0.05 ? "text-alert font-semibold" : ""}`}>{fmtPct(s.error_rate * 100, 2)}</td>
                    <td className="text-right">{fmtDuration(s.p50)}</td>
                    <td className="text-right">{fmtDuration(s.p95)}</td>
                    <td className="text-right">{fmtDuration(s.p99)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export function ApmService() {
  const { service } = useParams<{ service: string }>();
  const svc = decodeURIComponent(service);
  const { from, to, tick } = useTime();
  const [res, setRes] = useState<string | null>(null);
  const d = useQuery({
    queryKey: ["apm-service", svc, from, to, tick],
    queryFn: () => api<any>(`/ui/apm/services/${encodeURIComponent(svc)}?from=${from}&to=${to}`),
  });
  const traces = useQuery({
    queryKey: ["svc-traces", svc, res, from, to, tick],
    queryFn: () =>
      api<{ spans: Span[] }>("/ui/apm/spans", {
        body: { query: `service:${svc}${res ? ` resource_name:"${res.replace(/"/g, '\\"')}"` : ""}`, from, to, limit: 50, topLevelOnly: true },
      }),
  });
  const ts = d.data?.timeseries ?? [];
  const interval = d.data?.interval ?? 60;
  return (
    <div className="bg-canvas min-h-full">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ background: svcColor(svc) }} />
            {svc}
          </span>
        }
        sub={d.data?.operations?.join(", ")}
      >
        <TimePicker />
      </PageHeader>
      <ApmTabs />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className={cardStyles({ className: "p-3" })}>
            <div className="text-xs font-semibold mb-1">
              Requests <span className="text-ink-3 font-normal">hits/s</span>
            </div>
            <TimeseriesChart
              type="bars"
              height={170}
              from={from}
              to={to}
              series={[{ label: "hits/s", points: ts.map((p: any) => [p.t, p.hits / interval]), color: "#5b7be0" }]}
            />
          </div>
          <div className={cardStyles({ className: "p-3" })}>
            <div className="text-xs font-semibold mb-1">
              Errors <span className="text-ink-3 font-normal">errors/s</span>
            </div>
            <TimeseriesChart
              type="bars"
              height={170}
              from={from}
              to={to}
              series={[{ label: "errors/s", points: ts.map((p: any) => [p.t, p.errors / interval]), color: "#d33b4c" }]}
            />
          </div>
          <div className={cardStyles({ className: "p-3" })}>
            <div className="text-xs font-semibold mb-1">Latency</div>
            <TimeseriesChart
              height={170}
              from={from}
              to={to}
              yFormat={(v) => fmtDuration(v)}
              showLegend
              series={[
                { label: "p50", points: ts.map((p: any) => [p.t, p.p50]) },
                { label: "p95", points: ts.map((p: any) => [p.t, p.p95]) },
                { label: "p99", points: ts.map((p: any) => [p.t, p.p99]) },
              ]}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className={cardStyles({ className: "col-span-2" })}>
            <div className="px-4 py-2 border-b border-line font-semibold">Resources</div>
            <table className={tableStyles()}>
              <thead>
                <tr>
                  <th>Resource</th>
                  <th className="!text-right">Requests</th>
                  <th className="!text-right">P50</th>
                  <th className="!text-right">P95</th>
                  <th className="!text-right">P99</th>
                  <th className="!text-right">Errors</th>
                  <th className="!text-right">Total time</th>
                </tr>
              </thead>
              <tbody>
                {(d.data?.resources ?? []).map((r: any) => (
                  <tr
                    key={r.resource + r.name}
                    className={`cursor-pointer ${res === r.resource ? "bg-brand-100" : ""}`}
                    onClick={() => setRes(res === r.resource ? null : r.resource)}
                    data-testid="resource-row"
                  >
                    <td className="mono text-xs truncate max-w-[340px]">{r.resource}</td>
                    <td className="text-right">{fmtNum(r.hits)}</td>
                    <td className="text-right">{fmtDuration(r.p50)}</td>
                    <td className="text-right">{fmtDuration(r.p95)}</td>
                    <td className="text-right">{fmtDuration(r.p99)}</td>
                    <td className={`text-right ${r.errors ? "text-alert" : ""}`}>{r.errors}</td>
                    <td className="text-right">{fmtDuration(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={cardStyles()}>
            <div className="px-4 py-2 border-b border-line font-semibold">Downstream services</div>
            {(d.data?.downstream ?? []).map((x: any) => (
              <Link
                key={x.service}
                href={`/apm/services/${encodeURIComponent(x.service)}`}
                className="flex items-center gap-2 px-4 py-1.5 text-xs border-b border-line hover:bg-brand-100"
              >
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: svcColor(x.service) }} />
                <span className="flex-1">{x.service}</span>
                <span className="text-ink-3">
                  {x.calls} calls · avg {fmtDuration(x.avg)}
                </span>
              </Link>
            ))}
            {!d.data?.downstream?.length && <div className="px-4 py-3 text-xs text-ink-3">No downstream calls observed</div>}
          </div>
        </div>
        <div className={cardStyles()}>
          <div className="px-4 py-2 border-b border-line font-semibold flex">
            Traces{res && <span className="ml-2 chip">{res}</span>}
            <Link className="ml-auto text-xs font-normal text-primary" href={`/apm/traces?query=${encodeURIComponent(`service:${svc}`)}`}>
              Open in Trace Explorer →
            </Link>
          </div>
          <SpanTable spans={traces.data?.spans ?? []} />
        </div>
      </div>
    </div>
  );
}

function SpanTable({ spans }: { spans: Span[] }) {
  const [, nav] = useLocation();
  return (
    <table className={tableStyles()}>
      <thead>
        <tr>
          <th className="w-44">Date</th>
          <th>Service</th>
          <th>Resource</th>
          <th className="!text-right">Duration</th>
          <th>Method</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {spans.map((s) => (
          <tr key={s.id} className="cursor-pointer" onClick={() => nav(`/apm/trace/${s.trace_id}?span=${s.span_id}`)} data-testid="span-row">
            <td className="text-xs text-ink-2">{fmtTime(s.start_ms, true)}</td>
            <td>
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-sm" style={{ background: svcColor(s.service) }} />
                {s.service}
              </span>
            </td>
            <td className="mono text-xs truncate max-w-[380px]">{s.resource}</td>
            <td className="text-right text-xs">{fmtDuration(s.duration)}</td>
            <td className="text-xs">{s.meta?.["http.method"] ?? ""}</td>
            <td>
              {s.error ? (
                <span className="text-[11px] font-bold text-alert">ERROR</span>
              ) : (
                <span className="text-[11px] text-ok font-bold">{s.meta?.["http.status_code"] ?? "OK"}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TraceExplorer() {
  const params = new URLSearchParams(useSearch());
  const { from, to, tick } = useTime();
  const [query, setQuery] = useState(params.get("query") ?? "");
  const [input, setInput] = useState(params.get("query") ?? "");
  const [topOnly, setTopOnly] = useState(true);
  const spans = useQuery({
    queryKey: ["spans", query, topOnly, from, to, tick],
    queryFn: () =>
      api<{ spans: Span[]; total: number; total_capped?: boolean }>("/ui/apm/spans", { body: { query, from, to, limit: 200, topLevelOnly: topOnly } }),
  });
  const facets = useQuery({
    queryKey: ["span-facets", query, from, to, tick],
    queryFn: () => api<{ facets: Record<string, { value: string; count: number }[]> }>("/ui/apm/spans/facets", { body: { query, from, to } }),
  });
  const sel = (k: string) => [...query.matchAll(new RegExp(`(^|\\s)${k.replace(/[.@]/g, "\\$&")}:("[^"]*"|\\S+)`, "g"))].map((m) => m[2].replace(/^"|"$/g, ""));
  const toggle = (k: string, v: string) => {
    const tok = `${k}:${/[\s:()]/.test(v) ? `"${v}"` : v}`;
    const q = sel(k).includes(v) ? query.replace(tok, "").replace(/\s+/g, " ").trim() : `${query} ${tok}`.trim();
    setQuery(q);
    setInput(q);
  };
  return (
    <div className="h-full flex flex-col">
      <PageHeader title="APM" tabs={TABS.apm} sub={spans.data ? `${fmtNum(spans.data.total)}${spans.data.total_capped ? "+" : ""} spans` : undefined}>
        <TimePicker />
      </PageHeader>
      <div className="px-6 py-3 border-b border-line flex gap-3 items-center">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(input);
          }}
        >
          <Search size={14} className="absolute left-2.5 top-2.5 text-ink-3" />
          <Input
            className="w-full pl-8 mono text-xs"
            placeholder='service:web resource_name:"GET /users" @http.status_code:500 @duration:>100ms'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            data-testid="span-search"
          />
        </form>
        <label className="text-xs flex items-center gap-1.5">
          <input type="checkbox" className="accent-primary" checked={topOnly} onChange={(e) => setTopOnly(e.target.checked)} />
          Service entry spans only
        </label>
      </div>
      <div className="flex flex-1 min-h-0">
        <aside className="w-60 border-r border-line overflow-auto scroll-thin bg-panel">
          {Object.entries({
            service: "Service",
            env: "Env",
            status: "Status",
            resource_name: "Resource",
            operation_name: "Operation",
            "@http.status_code": "Status Code",
            host: "Host",
          }).map(([k, t]) => (
            <Facet key={k} title={t} values={facets.data?.facets[k] ?? []} selected={sel(k)} onToggle={(v) => toggle(k, v)} />
          ))}
        </aside>
        <div className="flex-1 overflow-auto scroll-thin">
          {(spans.data?.spans.length ?? 0) === 0 && !spans.isLoading ? <Empty title="No spans match" /> : <SpanTable spans={spans.data?.spans ?? []} />}
        </div>
      </div>
    </div>
  );
}

interface Node extends Span {
  children: Node[];
  depth: number;
}

export function TraceView() {
  const { traceId } = useParams<{ traceId: string }>();
  const params = new URLSearchParams(useSearch());
  const d = useQuery({ queryKey: ["trace", traceId], queryFn: () => api<{ spans: Span[]; logs: any[] }>(`/ui/apm/traces/${traceId}`) });
  const [selId, setSelId] = useState<string | null>(params.get("span"));
  const [tab, setTab] = useState<"flame" | "waterfall">("flame");
  const { roots, flat, start, end } = useMemo(() => {
    const spans = d.data?.spans ?? [];
    const by = new Map<string, Node>();
    for (const s of spans) by.set(s.span_id, { ...s, children: [], depth: 0 });
    const roots: Node[] = [];
    for (const n of by.values()) {
      const p = by.get(n.parent_id);
      if (p && p !== n) p.children.push(n);
      else roots.push(n);
    }
    const flat: Node[] = [];
    const walk = (n: Node, depth: number) => {
      n.depth = depth;
      flat.push(n);
      n.children.sort((a, b) => a.start - b.start).forEach((c) => walk(c, depth + 1));
    };
    roots.sort((a, b) => a.start - b.start).forEach((r) => walk(r, 0));
    const start = Math.min(...spans.map((s) => s.start)),
      end = Math.max(...spans.map((s) => s.start + s.duration));
    return { roots, flat, start, end };
  }, [d.data]);
  if (d.isLoading) return <div className="p-6 text-ink-3">Loading trace…</div>;
  if (!flat.length) return <Empty title="Trace not found">This trace may have expired or not been ingested yet.</Empty>;
  const total = Math.max(1, end - start);
  const root = roots[0];
  const sel = flat.find((s) => s.span_id === selId) ?? root;
  const maxDepth = Math.max(...flat.map((f) => f.depth));
  const services = [...new Set(flat.map((f) => f.service))];
  const execTime = new Map<string, number>();
  for (const f of flat) execTime.set(f.service, (execTime.get(f.service) ?? 0) + Math.max(0, f.duration - f.children.reduce((a, c) => a + c.duration, 0)));
  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ background: svcColor(root.service) }} />
            {root.service} <span className="text-ink-3 font-normal">·</span> <span className="mono text-sm">{root.resource}</span>
          </span>
        }
        sub={`${fmtDuration(total)} · ${flat.length} spans · ${fmtTime(root.start_ms, true)}`}
      >
        <Link className={buttonStyles()} href={`/logs?query=${encodeURIComponent(`trace_id:${traceId}`)}`}>
          View logs
        </Link>
      </PageHeader>
      <div className="flex gap-1 px-6 border-b border-line">
        {(["flame", "waterfall"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 h-9 border-b-2 text-[13px] ${tab === t ? "border-primary text-primary font-semibold" : "border-transparent text-ink-2"}`}
          >
            {t === "flame" ? "Flame Graph" : "Waterfall"}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-xs">
          {services.map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: svcColor(s) }} />
              {s} <span className="text-ink-3">{((execTime.get(s)! / total) * 100).toFixed(0)}%</span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="overflow-auto scroll-thin border-b border-line" style={{ maxHeight: "50%" }}>
          {tab === "flame" ? (
            <div className="relative p-4" style={{ height: (maxDepth + 1) * 26 + 32 }} data-testid="flame-graph">
              {flat.map((s) => (
                <div
                  key={s.span_id}
                  onClick={() => setSelId(s.span_id)}
                  title={`${s.service} ${s.name}\n${s.resource}\n${fmtDuration(s.duration)}`}
                  className={`absolute h-[22px] rounded-[2px] pl-1.5 pr-1 text-[11px] leading-[22px] text-ink truncate cursor-pointer hover:brightness-95 ${sel.span_id === s.span_id ? "ring-2 ring-primary z-10" : ""}`}
                  style={{
                    left: `calc(${((s.start - start) / total) * 100}% )`,
                    width: `max(3px, ${(s.duration / total) * 100}%)`,
                    top: 16 + s.depth * 25,
                    background: `${s.error ? "#e0414f" : svcColor(s.service)}33`,
                    borderLeft: `3px solid ${s.error ? "#e0414f" : svcColor(s.service)}`,
                  }}
                >
                  <b className="font-semibold">{s.name}</b> <span className="text-ink-2">{s.resource !== s.name ? s.resource : ""}</span>
                </div>
              ))}
            </div>
          ) : (
            <table className={tableStyles()}>
              <tbody>
                {flat.map((s) => (
                  <tr key={s.span_id} onClick={() => setSelId(s.span_id)} className={`cursor-pointer ${sel.span_id === s.span_id ? "bg-brand-100" : ""}`}>
                    <td className="w-[40%]">
                      <div style={{ paddingLeft: s.depth * 14 }} className="flex items-center gap-1.5 text-xs truncate">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: svcColor(s.service) }} />
                        <b>{s.service}</b> {s.name} <span className="text-ink-3 truncate">{s.resource}</span>
                      </div>
                    </td>
                    <td>
                      <div className="relative h-4">
                        <div
                          className="absolute h-4 rounded-sm"
                          style={{
                            left: `${((s.start - start) / total) * 100}%`,
                            width: `max(2px, ${(s.duration / total) * 100}%)`,
                            background: s.error ? "#d33b4c" : svcColor(s.service),
                          }}
                        />
                      </div>
                    </td>
                    <td className="w-24 text-right text-xs">{fmtDuration(s.duration)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex-1 overflow-auto scroll-thin p-5 grid grid-cols-2 gap-6">
          <div>
            <div className={sectionTitleStyles({ className: "mb-1" })}>{sel.name}</div>
            <div className="mono text-xs text-ink-2 mb-3 break-all">{sel.resource}</div>
            <div className="grid grid-cols-[140px_1fr] gap-y-1 text-xs">
              <span className="text-ink-3">Service</span>
              <Link className="text-primary" href={`/apm/services/${encodeURIComponent(sel.service)}`}>
                {sel.service}
              </Link>
              <span className="text-ink-3">Duration</span>
              <span>
                {fmtDuration(sel.duration)} ({((sel.duration / total) * 100).toFixed(1)}% of trace)
              </span>
              <span className="text-ink-3">Start</span>
              <span>+{fmtDuration(sel.start - start)}</span>
              <span className="text-ink-3">Host</span>
              <span>{sel.host || "—"}</span>
              <span className="text-ink-3">Env</span>
              <span>{sel.env || "—"}</span>
              <span className="text-ink-3">Span / Trace ID</span>
              <span className="mono">
                {sel.span_id} / {sel.trace_id}
              </span>
            </div>
            {sel.error ? (
              <div className="mt-3 card border-alert/30 bg-red-50 p-3 text-xs">
                <div className="font-semibold text-alert">{sel.meta["error.type"] ?? sel.meta["error.kind"] ?? "Error"}</div>
                <div>{sel.meta["error.message"] ?? sel.meta["error.msg"]}</div>
                {sel.meta["error.stack"] && <pre className="mono text-[11px] mt-2 whitespace-pre-wrap">{sel.meta["error.stack"]}</pre>}
              </div>
            ) : null}
          </div>
          <div>
            <div className={labelStyles({ className: "mb-1" })}>Tags</div>
            <div className="text-xs space-y-0.5">
              {Object.entries(sel.meta ?? {})
                .filter(([k]) => !k.startsWith("error.stack"))
                .map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-primary w-44 shrink-0 truncate">{k}</span>
                    <span className="mono break-all">{String(v)}</span>
                  </div>
                ))}
            </div>
            {(d.data?.logs ?? []).length > 0 && (
              <div className="mt-4">
                <div className={labelStyles({ className: "mb-1" })}>Logs ({d.data!.logs.length})</div>
                {d.data!.logs.map((l) => (
                  <div key={l.id} className="flex gap-2 text-xs py-0.5">
                    <span className="w-1 rounded" style={{ background: STATUS_COLORS[l.status] }} />
                    <span className="text-ink-3">{fmtTime(l.ts)}</span>
                    <span className="truncate">{l.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
