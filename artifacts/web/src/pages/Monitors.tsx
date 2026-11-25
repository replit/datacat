import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { Plus, Search, BellOff, Bell, Pencil, Trash2, Copy, LineChart, ScrollText, Activity, ChevronDown, ChevronRight, Hash, Webhook } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader, TABS } from "@/components/Layout";
import { StatusBadge, Empty } from "@/components/Panels";
import { TimeseriesChart } from "@/components/Chart";
import { MetricQueryRow } from "@/components/QueryEditor";
import { TimePicker } from "@/components/TimePicker";
import { useTime } from "@/lib/time";
import { fmtAgo, fmtNum, fmtTime } from "@/lib/format";
import { Button, Input, Select, Textarea, badgeStyles, buttonStyles, cardStyles, cn, sectionTitleStyles, tableStyles } from "@/components/ui";

export interface Monitor {
  id: number;
  name: string;
  type: string;
  query: string;
  message: string;
  tags: string[];
  priority: number | null;
  options: any;
  overall_state: string;
  group_states: Record<string, { state: string; value: number | null; tags: string[]; since: number }>;
  muted_until: number | null;
  last_triggered_at: number | null;
  creator: { name: string };
  modified: string;
}

const STATES = ["Alert", "Warn", "No Data", "OK"];
const TYPE_LABEL: Record<string, string> = { "metric alert": "Metric", "query alert": "Metric", "log alert": "Logs", "trace-analytics alert": "APM" };

const STATE_BAR: Record<string, string> = { Alert: "bg-alert", Warn: "bg-warn", "No Data": "bg-nodata", OK: "bg-ok" };
const recipients = (m: Monitor) => [...new Set(m.message.match(/@[\w.\-]+/g) ?? [])];

function FacetGroup({ title, children, defaultOpen = true }: { title: string; children: any; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line">
      <div className="flex items-center gap-1 px-3 h-8 text-[13px] font-semibold text-ink cursor-pointer select-none" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </div>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}
function FacetRow({ checked, onChange, children, count, indent }: { checked: boolean; onChange: () => void; children: any; count?: number; indent?: boolean }) {
  return (
    <label className={`flex items-center gap-2 pr-3 ${indent ? "pl-8" : "pl-4"} h-[26px] text-[13px] cursor-pointer hover:bg-brand-50`}>
      <input type="checkbox" className="accent-primary" checked={checked} onChange={onChange} />
      <span className="flex-1 truncate flex items-center gap-1.5">{children}</span>
      {count !== undefined && <span className="text-[12px] text-ink-3">{count}</span>}
    </label>
  );
}

export function MonitorList() {
  const search = useSearch();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [states, setStates] = useState<string[]>(() => {
    const s = new URLSearchParams(search).get("status");
    return s ? (s === "Alert" ? ["Alert", "Warn", "No Data"] : [s]) : [];
  });
  useEffect(() => {
    const s = new URLSearchParams(search).get("status");
    setStates(s ? (s === "Alert" ? ["Alert", "Warn", "No Data"] : [s]) : []);
  }, [search]);
  const [types, setTypes] = useState<string[]>([]);
  const [muted, setMuted] = useState<string[]>([]);
  const [recips, setRecips] = useState<string[]>([]);
  const [prios, setPrios] = useState<string[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [hide, setHide] = useState(false);
  const mons = useQuery({ queryKey: ["monitors"], queryFn: () => api<Monitor[]>("/v1/monitor"), refetchInterval: 15_000 });
  const all = mons.data ?? [];
  const isMuted = (m: Monitor) => !!(m.muted_until && m.muted_until * 1000 > Date.now());
  const pr = (m: Monitor) => (m.priority ? `P${m.priority}` : "Not Defined");
  const rows = all.filter(
    (m) =>
      (!states.length || states.includes(m.overall_state)) &&
      (!types.length || types.includes(TYPE_LABEL[m.type] ?? m.type)) &&
      (!muted.length || muted.includes(isMuted(m) ? "True" : "False")) &&
      (!recips.length || recipients(m).some((r) => recips.includes(r))) &&
      (!prios.length || prios.includes(pr(m))) &&
      (!q || m.name.toLowerCase().includes(q.toLowerCase()) || m.tags.some((t) => t.includes(q)) || m.query.includes(q)),
  );
  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const triggered = ["Alert", "Warn", "No Data"];
  const allRecips = [...new Set(all.flatMap(recipients))];
  const bulk = useMutation({
    mutationFn: async (action: "mute" | "unmute" | "delete") => {
      for (const id of sel)
        await api(action === "delete" ? `/v1/monitor/${id}` : `/v1/monitor/${id}/${action}`, action === "delete" ? { method: "DELETE" } : { body: {} });
    },
    onSuccess: () => {
      setSel([]);
      qc.invalidateQueries({ queryKey: ["monitors"] });
    },
  });
  const mutedLeft = (m: Monitor) => {
    if (!isMuted(m)) return null;
    const left = m.muted_until! * 1000 - Date.now();
    return left > 365 * 86400_000
      ? "∞"
      : left > 86400_000
        ? `${Math.round(left / 86400_000)}d`
        : left > 3600_000
          ? `${Math.round(left / 3600_000)}h`
          : `${Math.max(1, Math.round(left / 60_000))}m`;
  };
  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Monitors" tabs={TABS.mon}>
        <Link href="/monitors/create" className={buttonStyles({ variant: "primary" })} data-testid="new-monitor">
          <Plus size={14} /> New Monitor
        </Link>
      </PageHeader>
      <div className="px-5 pt-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2 text-ink-3" />
          <Input className="w-full pl-8" placeholder="Filter monitors" value={q} onChange={(e) => setQ(e.target.value)} data-testid="monitor-search" />
        </div>
      </div>
      <div className="flex flex-1 min-h-0 px-5 gap-4">
        {!hide && (
          <aside className="w-60 shrink-0 card self-start overflow-auto max-h-full mb-4">
            <FacetGroup title="Status">
              <FacetRow
                checked={triggered.every((s) => states.includes(s))}
                onChange={() =>
                  setStates(triggered.every((s) => states.includes(s)) ? states.filter((s) => !triggered.includes(s)) : [...new Set([...states, ...triggered])])
                }
                count={all.filter((m) => triggered.includes(m.overall_state)).length}
              >
                Triggered
              </FacetRow>
              {triggered.map((s) => (
                <FacetRow
                  key={s}
                  indent
                  checked={states.includes(s)}
                  onChange={() => toggle(states, s, setStates)}
                  count={all.filter((m) => m.overall_state === s).length}
                >
                  <span className={`w-[3px] h-3.5 rounded-sm ${STATE_BAR[s]}`} />
                  {s}
                </FacetRow>
              ))}
              <FacetRow
                checked={states.includes("OK")}
                onChange={() => toggle(states, "OK", setStates)}
                count={all.filter((m) => m.overall_state === "OK").length}
              >
                <span className="w-[3px] h-3.5 rounded-sm bg-ok" />
                OK
              </FacetRow>
            </FacetGroup>
            <FacetGroup title="Muted">
              {["True", "False"].map((v) => (
                <FacetRow
                  key={v}
                  checked={muted.includes(v)}
                  onChange={() => toggle(muted, v, setMuted)}
                  count={all.filter((m) => (isMuted(m) ? "True" : "False") === v).length}
                >
                  {v}
                </FacetRow>
              ))}
            </FacetGroup>
            <FacetGroup title="Notification Recipient">
              {allRecips.length === 0 && <div className="px-4 text-[12px] text-ink-3">No recipients</div>}
              {allRecips.map((r) => (
                <FacetRow
                  key={r}
                  checked={recips.includes(r)}
                  onChange={() => toggle(recips, r, setRecips)}
                  count={all.filter((m) => recipients(m).includes(r)).length}
                >
                  {r.startsWith("@slack") ? <Hash size={12} className="text-ink-3" /> : <Webhook size={12} className="text-ink-3" />}
                  {r.slice(1)}
                </FacetRow>
              ))}
            </FacetGroup>
            <FacetGroup title="Monitor Type">
              {["Metric", "Logs", "APM"].map((t) => (
                <FacetRow
                  key={t}
                  checked={types.includes(t)}
                  onChange={() => toggle(types, t, setTypes)}
                  count={all.filter((m) => (TYPE_LABEL[m.type] ?? m.type) === t).length}
                >
                  {t}
                </FacetRow>
              ))}
            </FacetGroup>
            <FacetGroup title="Priority" defaultOpen={false}>
              {["P1", "P2", "P3", "P4", "P5", "Not Defined"].map((p) => (
                <FacetRow key={p} checked={prios.includes(p)} onChange={() => toggle(prios, p, setPrios)} count={all.filter((m) => pr(m) === p).length}>
                  {p}
                </FacetRow>
              ))}
            </FacetGroup>
          </aside>
        )}
        <div className="flex-1 min-w-0 overflow-auto pb-4">
          <div className="flex items-center gap-4 h-8 text-[12px]">
            <button className="text-primary" onClick={() => setHide(!hide)}>
              {hide ? "Show Controls" : "Hide Controls"}
            </button>
            <span className="text-ink-2">
              Showing {rows.length ? `1–${rows.length}` : 0} of {all.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5 py-1.5 border-y border-line">
            <input
              type="checkbox"
              className="accent-primary ml-3 mr-1"
              checked={rows.length > 0 && sel.length === rows.length}
              onChange={(e) => setSel(e.target.checked ? rows.map((m) => m.id) : [])}
              aria-label="Select all"
            />
            <Button size="sm" disabled={!sel.length} onClick={() => bulk.mutate("mute")}>
              <BellOff size={12} /> Mute
            </Button>
            <Button size="sm" disabled={!sel.length} onClick={() => bulk.mutate("unmute")}>
              <Bell size={12} /> Unmute
            </Button>
            <Button size="sm" disabled={!sel.length} onClick={() => confirm(`Delete ${sel.length} monitor(s)?`) && bulk.mutate("delete")}>
              <Trash2 size={12} /> Delete
            </Button>
            {sel.length > 0 && <span className="text-[12px] text-ink-2 ml-2">{sel.length} selected</span>}
          </div>
          {rows.length === 0 && !mons.isLoading ? (
            <Empty title={all.length ? "No monitors match" : "No monitors yet"}>
              Monitors watch your metrics, logs and traces and notify your team when something needs attention.{" "}
              <Link href="/monitors/create" className="text-primary">
                Create a monitor →
              </Link>
            </Empty>
          ) : (
            <table className={tableStyles()}>
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th className="w-20">Priority</th>
                  <th className="w-24">Status</th>
                  <th className="w-24">Muted left</th>
                  <th>Name</th>
                  <th>Tags</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} data-testid="monitor-row">
                    <td>
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={sel.includes(m.id)}
                        onChange={() => setSel(sel.includes(m.id) ? sel.filter((x) => x !== m.id) : [...sel, m.id])}
                      />
                    </td>
                    <td className="text-ink-2">{m.priority ? `P${m.priority}` : "-"}</td>
                    <td>
                      <StatusBadge state={m.overall_state} />
                    </td>
                    <td className="text-ink-2">
                      {mutedLeft(m) && (
                        <span className="inline-flex items-center gap-1 text-warn">
                          <BellOff size={13} />
                          {mutedLeft(m)}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[520px]">
                      <Link href={`/monitors/${m.id}`} className="block truncate text-ink hover:text-primary hover:underline">
                        {m.name}
                      </Link>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {m.tags.slice(0, 2).map((t) => (
                          <span key={t} className={badgeStyles()}>
                            {t}
                          </span>
                        ))}
                        {m.tags.length > 2 && <span className={badgeStyles()}>+{m.tags.length - 2}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1 text-ink-3">
                        {recipients(m)
                          .slice(0, 3)
                          .map((r) => (
                            <span key={r} title={r}>
                              {r.startsWith("@slack") ? <Hash size={14} /> : <Webhook size={14} />}
                            </span>
                          ))}
                      </div>
                    </td>
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

// ---------- Create / Edit ----------
type Kind = "metric" | "log" | "apm";
interface Form {
  kind: Kind;
  query: string;
  timeAgg: string;
  window: string;
  logQuery: string;
  groupBy: string;
  op: string;
  critical: string;
  warning: string;
  recovery: string;
  name: string;
  message: string;
  tags: string;
  notifyNoData: boolean;
  renotify: string;
  priority: string;
}

function toQuery(f: Form): { type: string; query: string } {
  const op = f.op;
  const thr = f.critical || "0";
  if (f.kind === "metric") return { type: "metric alert", query: `${f.timeAgg}(last_${f.window}):${f.query} ${op} ${thr}` };
  const by = f.groupBy ? `.by("${f.groupBy}")` : "";
  if (f.kind === "log")
    return { type: "log alert", query: `logs("${f.logQuery.replace(/"/g, '\\"')}").index("*").rollup("count")${by}.last("${f.window}") ${op} ${thr}` };
  return { type: "trace-analytics alert", query: `spans("${f.logQuery.replace(/"/g, '\\"')}").rollup("count")${by}.last("${f.window}") ${op} ${thr}` };
}

function fromMonitor(m: Monitor): Form {
  const base: Form = {
    kind: "metric",
    query: "avg:system.cpu.user{*} by {host}",
    timeAgg: "avg",
    window: "5m",
    logQuery: "status:error",
    groupBy: "",
    op: ">",
    critical: "",
    warning: "",
    recovery: "",
    name: m.name,
    message: m.message,
    tags: m.tags.join(", "),
    notifyNoData: !!m.options?.notify_no_data,
    renotify: String(m.options?.renotify_interval ?? ""),
    priority: m.priority ? String(m.priority) : "",
  };
  const cmp = /\s*(>=|<=|>|<)\s*(-?[\d.]+)\s*$/.exec(m.query);
  if (cmp) {
    base.op = cmp[1];
    base.critical = cmp[2];
  }
  base.critical = String(m.options?.thresholds?.critical ?? base.critical);
  base.warning = m.options?.thresholds?.warning !== undefined ? String(m.options.thresholds.warning) : "";
  base.recovery = m.options?.thresholds?.critical_recovery !== undefined ? String(m.options.thresholds.critical_recovery) : "";
  const body = cmp ? m.query.slice(0, cmp.index) : m.query;
  const mm = /^(\w+)\(last_(\d+[smhdw])\):(.*)$/.exec(body.trim());
  if (mm) {
    base.kind = "metric";
    base.timeAgg = mm[1];
    base.window = mm[2];
    base.query = mm[3].trim();
  }
  const lm = /^(logs|spans|trace-analytics)\("((?:[^"\\]|\\.)*)"\)(.*)$/.exec(body.trim());
  if (lm) {
    base.kind = lm[1] === "logs" ? "log" : "apm";
    base.logQuery = lm[2].replace(/\\"/g, '"');
    base.window = /\.last\("([^"]+)"\)/.exec(lm[3])?.[1] ?? "5m";
    base.groupBy = /\.by\("([^"]*)"\)/.exec(lm[3])?.[1] ?? "";
  }
  return base;
}

function Step({ n, title, children }: { n: number; title: string; children: any }) {
  return (
    <section className={cardStyles({ className: "p-5" })}>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-6 h-6 rounded-full bg-subtle text-ink text-[12px] font-bold flex items-center justify-center">{n}</span>
        <span className="text-[16px] font-semibold">{title}</span>
      </div>
      {children}
    </section>
  );
}

function Preview({ f, active = true }: { f: Form; active?: boolean }) {
  const { from, to, tick } = useTime();
  const q = useQuery({
    enabled: active,
    queryKey: ["mon-preview", f.kind, f.query, f.logQuery, f.groupBy, from, to, tick],
    queryFn: async () => {
      if (f.kind === "metric") {
        const r = await api<{ series: any[] }>("/ui/metrics/query", { body: { queries: [{ name: "a", query: f.query }], from, to } });
        return r.series.map((s) => ({ label: s.group.join(",") || f.query, points: s.pointlist }));
      }
      if (f.kind === "log") {
        const r = await api<{ series: any[] }>("/ui/logs/aggregate", { body: { query: f.logQuery, groupBy: f.groupBy, from, to, type: "timeseries" } });
        return r.series.map((s) => ({ label: s.group.join(",") || "count", points: s.pointlist }));
      }
      const r = await api<{ spans: any[] }>("/ui/apm/spans", { body: { query: f.logQuery, from, to, limit: 1000 } });
      const b = new Map<number, number>();
      for (const s of r.spans) {
        const t = Math.floor(s.start_ms / 60000) * 60000;
        b.set(t, (b.get(t) ?? 0) + 1);
      }
      return [{ label: "count", points: [...b].sort((a, c) => a[0] - c[0]) as [number, number][] }];
    },
  });
  const th = [] as any[];
  if (f.critical !== "") th.push({ value: Number(f.critical), color: "#d33b4c", label: "Alert", above: f.op.startsWith(">") });
  if (f.warning !== "") th.push({ value: Number(f.warning), color: "#e8a317", label: "Warn" });
  return (
    <div className={cardStyles({ className: "p-3 bg-white" })}>
      <div className="flex items-center mb-1 text-xs text-ink-2">
        Evaluation preview
        <div className="ml-auto">
          <TimePicker />
        </div>
      </div>
      <TimeseriesChart series={q.data ?? []} height={220} thresholds={th} from={from} to={to} showLegend={(q.data?.length ?? 0) > 1} />
    </div>
  );
}

export function MonitorEdit() {
  const params = useParams<{ id?: string }>();
  const search = useSearch();
  const editingId = params.id ? Number(params.id) : null;
  const cloneId = new URLSearchParams(search).get("clone");
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const [f, setF] = useState<Form>({
    kind: (new URLSearchParams(search).get("type") as Kind) || "metric",
    query: "avg:system.cpu.user{*} by {host}",
    timeAgg: "avg",
    window: "5m",
    logQuery: "status:error",
    groupBy: "",
    op: ">",
    critical: "90",
    warning: "",
    recovery: "",
    name: "",
    message: "{{#is_alert}}\n{{value}} is above the {{threshold}} threshold.\n{{/is_alert}}\n{{#is_recovery}}\nBack to normal.\n{{/is_recovery}}\n",
    tags: "",
    notifyNoData: false,
    renotify: "",
    priority: "",
  });
  const existing = useQuery({
    queryKey: ["monitor", editingId ?? cloneId],
    queryFn: () => api<Monitor>(`/v1/monitor/${editingId ?? cloneId}`),
    enabled: !!(editingId || cloneId),
  });
  useEffect(() => {
    if (existing.data) {
      const ff = fromMonitor(existing.data);
      if (cloneId) ff.name = `[Clone] ${ff.name}`;
      setF(ff);
    }
  }, [existing.data]);
  const channels = useQuery({ queryKey: ["channels"], queryFn: () => api<{ channels: any[] }>("/ui/channels") });
  const set = (p: Partial<Form>) => setF((prev) => ({ ...prev, ...p }));
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const { type, query } = toQuery(f);
      const body = {
        name: f.name || defaultName(f),
        type,
        query,
        message: f.message,
        tags: f.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        priority: f.priority ? Number(f.priority) : null,
        options: {
          thresholds: {
            critical: Number(f.critical),
            ...(f.warning !== "" ? { warning: Number(f.warning) } : {}),
            ...(f.recovery !== "" ? { critical_recovery: Number(f.recovery) } : {}),
          },
          notify_no_data: f.notifyNoData,
          renotify_interval: f.renotify ? Number(f.renotify) : 0,
        },
      };
      return editingId ? api<Monitor>(`/v1/monitor/${editingId}`, { method: "PUT", body }) : api<Monitor>("/v1/monitor", { body });
    },
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["monitors"] });
      qc.invalidateQueries({ queryKey: ["monitor", m.id] });
      nav(`/monitors/${m.id}`);
    },
    onError: (e: any) => setErr(e.message),
  });
  const kinds: { k: Kind; label: string; icon: any; desc: string }[] = [
    { k: "metric", label: "Metric", icon: LineChart, desc: "Compare values of a metric with a user-defined threshold" },
    { k: "log", label: "Logs", icon: ScrollText, desc: "Alert when a specified type of log exceeds a threshold" },
    { k: "apm", label: "APM", icon: Activity, desc: "Alert on the count of matching spans (errors, slow requests)" },
  ];
  return (
    <div className="bg-panel min-h-full">
      <PageHeader title={editingId ? `Edit monitor` : "New Monitor"} sub={editingId ? f.name : undefined}>
        <Link href="/monitors/manage" className={buttonStyles()}>
          Cancel
        </Link>
        <Button variant="primary" onClick={() => save.mutate()} disabled={save.isPending} data-testid="save-monitor">
          {editingId ? "Save" : "Create"}
        </Button>
      </PageHeader>
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        {!editingId && (
          <div className="grid grid-cols-3 gap-3">
            {kinds.map((k) => (
              <button
                key={k.k}
                onClick={() => set({ kind: k.k })}
                className={cardStyles({ className: cn("p-4 text-left", f.kind === k.k ? "border-primary ring-2 ring-brand-100" : "hover:border-brand-400") })}
                data-testid={`monitor-type-${k.k}`}
              >
                <div className="flex items-center gap-2 font-semibold mb-1">
                  <k.icon size={16} className="text-primary" />
                  {k.label}
                </div>
                <div className="text-xs text-ink-2">{k.desc}</div>
              </button>
            ))}
          </div>
        )}
        {(["metric", "log", "apm"] as Kind[]).map((k) => (
          <div key={k} className={f.kind === k ? "" : "hidden"}>
            <Preview f={{ ...f, kind: k }} active={f.kind === k} />
          </div>
        ))}
        <Step n={1} title={f.kind === "metric" ? "Define the metric" : f.kind === "log" ? "Define the search query" : "Define the span query"}>
          <div className={f.kind === "metric" ? "" : "hidden"}>
            <div className="space-y-3">
              <MetricQueryRow q={{ name: "a", query: f.query }} onChange={(q) => set({ query: q.query })} />
              <div className="flex items-center gap-2 text-[13px] pl-8">
                <span>Evaluate the</span>
                <Select value={f.timeAgg} onChange={(e) => set({ timeAgg: e.target.value })}>
                  {[
                    ["avg", "average"],
                    ["max", "maximum"],
                    ["min", "minimum"],
                    ["sum", "sum"],
                    ["last", "last"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
                <span>of the query over the</span>
                <Select value={f.window} onChange={(e) => set({ window: e.target.value })}>
                  {[
                    ["1m", "last 1 minute"],
                    ["5m", "last 5 minutes"],
                    ["10m", "last 10 minutes"],
                    ["15m", "last 15 minutes"],
                    ["30m", "last 30 minutes"],
                    ["1h", "last 1 hour"],
                    ["4h", "last 4 hours"],
                    ["1d", "last 1 day"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
              <p className="text-xs text-ink-3 pl-8">
                Add <span className="mono">by {"{host}"}</span> to get a separate alert for each host (multi alert).
              </p>
            </div>
          </div>
          <div className={f.kind === "metric" ? "hidden" : ""}>
            <div className="space-y-3">
              <Input
                className="w-full mono text-xs"
                value={f.logQuery}
                onChange={(e) => set({ logQuery: e.target.value })}
                placeholder={f.kind === "log" ? "service:web status:error" : "service:web status:error"}
                data-testid="monitor-search-query"
              />
              <div className="flex items-center gap-2 text-[13px]">
                <span>{f.kind === "log" ? "Count matching logs over the" : "Count matching spans over the"}</span>
                <Select value={f.window} onChange={(e) => set({ window: e.target.value })}>
                  {["1m", "5m", "10m", "15m", "30m", "1h", "4h", "1d"].map((v) => (
                    <option key={v} value={v}>
                      last {v}
                    </option>
                  ))}
                </Select>
                <span>grouped by</span>{" "}
                <Input className="w-40" value={f.groupBy} onChange={(e) => set({ groupBy: e.target.value })} placeholder="(none) e.g. service" />
              </div>
            </div>
          </div>
        </Step>
        <Step n={2} title="Set alert conditions">
          <div className="space-y-3 text-[13px]">
            <div className="flex items-center gap-2">
              <span>Trigger when the evaluated value is</span>
              <Select value={f.op} onChange={(e) => set({ op: e.target.value })}>
                {[
                  [">", "above"],
                  [">=", "above or equal to"],
                  ["<", "below"],
                  ["<=", "below or equal to"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
              <span>the threshold</span>
            </div>
            <div className="grid grid-cols-[160px_160px] gap-x-4 gap-y-2 items-center">
              <label className="font-semibold text-alert">Alert threshold</label>
              <Input value={f.critical} onChange={(e) => set({ critical: e.target.value })} data-testid="critical-threshold" />
              <label className="font-semibold text-warn">Warning threshold</label>
              <Input value={f.warning} onChange={(e) => set({ warning: e.target.value })} placeholder="optional" />
              <label className="text-ink-2">Alert recovery threshold</label>
              <Input value={f.recovery} onChange={(e) => set({ recovery: e.target.value })} placeholder="optional" />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-primary" checked={f.notifyNoData} onChange={(e) => set({ notifyNoData: e.target.checked })} />
              Notify if data is missing
            </label>
          </div>
        </Step>
        <Step n={3} title="Configure notifications & automations">
          <div className="space-y-3">
            <Input className="w-full" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder={defaultName(f)} data-testid="monitor-name" />
            <Textarea
              className="w-full h-36 py-2 mono text-xs"
              value={f.message}
              onChange={(e) => set({ message: e.target.value })}
              data-testid="monitor-message"
            />
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-ink-3">Notify:</span>
              {(channels.data?.channels ?? []).map((c) => (
                <button
                  key={c.id}
                  className={badgeStyles({ tone: "brand", className: "hover:bg-brand-100" })}
                  onClick={() => set({ message: f.message.trimEnd() + ` @${c.kind === "slack" ? "slack" : "webhook"}-${c.name}\n` })}
                >
                  @{c.kind === "slack" ? "slack" : "webhook"}-{c.name}
                </button>
              ))}
              <Link href="/organization-settings?tab=integrations" className="text-primary">
                Add a webhook or Slack channel →
              </Link>
            </div>
            <p className="text-xs text-ink-3">
              Template variables:{" "}
              <span className="mono">{"{{value}} {{threshold}} {{host.name}} {{#is_alert}}…{{/is_alert}} {{#is_recovery}}…{{/is_recovery}}"}</span>
            </p>
            <div className="flex gap-4">
              <label className="text-xs">
                Tags <Input className="w-72 ml-1" value={f.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="team:web, env:prod" />
              </label>
              <label className="text-xs">
                Re-notify every{" "}
                <Select className="ml-1" value={f.renotify} onChange={(e) => set({ renotify: e.target.value })}>
                  <option value="">never</option>
                  <option value="10">10 min</option>
                  <option value="30">30 min</option>
                  <option value="60">1 hour</option>
                </Select>
              </label>
              <label className="text-xs">
                Priority{" "}
                <Select className="ml-1" value={f.priority} onChange={(e) => set({ priority: e.target.value })}>
                  <option value="">none</option>
                  {[1, 2, 3, 4, 5].map((p) => (
                    <option key={p} value={p}>
                      P{p}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </div>
        </Step>
        {err && <div className={cardStyles({ className: "border-alert/40 bg-red-50 text-alert p-3 text-sm" })}>{err}</div>}
      </div>
    </div>
  );
}

function defaultName(f: Form) {
  if (f.kind === "metric")
    return `${f.query.split("{")[0].split(":")[1] ?? f.query} is ${f.op.startsWith(">") ? "high" : "low"}${f.query.includes(" by ") ? " on {{" + (/by \{([^},]+)/.exec(f.query)?.[1] ?? "host") + ".name}}" : ""}`;
  return `${f.kind === "log" ? "Logs" : "Spans"} matching "${f.logQuery}" ${f.op.startsWith(">") ? "above" : "below"} ${f.critical || "threshold"}`;
}

// ---------- Related telemetry (alert -> affected service -> failing traces and logs) ----------
// Services come from the monitor's own query (service:x / {service:x}) and from its alerting groups; every number
// shown is a direct count over the selected time range, with links to the underlying spans, traces and logs.
function servicesOf(query: string, groups: [string, any][]): string[] {
  const out = new Set<string>();
  for (const m of query.matchAll(/service:"?([\w.\-]+)"?/g)) out.add(m[1]);
  for (const [k, g] of groups) if (g.state !== "OK") for (const m of k.matchAll(/service:([\w.\-]+)/g)) out.add(m[1]);
  return [...out];
}
function WhatChanged({ service, since }: { service: string; since: number }) {
  // incident window: from 2 minutes before the alert started until now; baseline: the same length just before
  const from = Math.floor((since - 120_000) / 1000),
    to = Math.floor(Date.now() / 1000);
  const c = useQuery({
    queryKey: ["correlate", service, from],
    queryFn: () => api<any>(`/ui/correlate/${encodeURIComponent(service)}?from=${from}&to=${to}`),
    refetchInterval: 30_000,
  });
  if (!c.data) return <div className="text-ink-3">Comparing with the previous window…</div>;
  const d = c.data,
    ms = (ns: number | null) => (ns == null ? "–" : `${(ns / 1e6).toFixed(ns < 1e7 ? 1 : 0)} ms`);
  const t = (x: number) => fmtTime(x, true);
  const empty = !d.changes.length && !d.errors.length && !d.origins.length && !d.logs.length;
  return (
    <div className="border border-line rounded p-2 space-y-2 bg-white" data-testid="what-changed">
      <div className="font-semibold">
        What changed{" "}
        <span className="font-normal text-ink-3">
          {t(d.window.from)}–now vs {t(d.baseline.from)}–{t(d.baseline.to)}
        </span>
      </div>
      {empty && <div className="text-ink-3">No measurable change for this service between the two windows.</div>}
      {d.changes.map((x: any, i: number) => (
        <div key={`c${i}`} data-testid="change-item">
          <span className="inline-block px-1 rounded bg-amber-100 text-amber-800 mr-1">{x.kind === "version" ? "version" : "event"}</span>
          <span className="font-semibold">{x.detail}</span> <span className="text-ink-3">at {t(x.at)}</span>
          <div className="text-ink-2">{x.evidence}</div>
        </div>
      ))}
      {d.origins.slice(0, 2).map((o: any, i: number) => (
        <div key={`o${i}`} data-testid="origin-item">
          <span className="inline-block px-1 rounded bg-red-100 text-alert mr-1">deepest failing span</span>
          <span className="mono">
            {o.service} · {o.resource}
          </span>{" "}
          in <b>{o.traces}</b> of {o.failing_traces} failing traces
          <Link href={`/apm/trace/${o.example_trace}?span=${o.example_span}`} className="ml-2 text-primary hover:underline">
            example →
          </Link>
          {o.statement && <div className="mono text-ink-2 break-all">{String(o.statement).slice(0, 200)}</div>}
          {o.message && <div className="text-alert break-all">{String(o.message).slice(0, 200)}</div>}
        </div>
      ))}
      {d.errors.slice(0, 3).map((e: any, i: number) => (
        <div key={`e${i}`} data-testid="error-delta">
          <span className="inline-block px-1 rounded bg-red-50 text-alert mr-1">errors</span>
          <span className="mono">{e.resource}</span>:{" "}
          <b>
            {e.baseline} → {e.incident}
          </b>
          {e.message && <span className="text-ink-2"> · {String(e.message).slice(0, 120)}</span>}
          {e.example_trace && (
            <Link href={`/apm/trace/${e.example_trace}?span=${e.example_span}`} className="ml-2 text-primary hover:underline">
              example →
            </Link>
          )}
        </div>
      ))}
      {d.logs.slice(0, 2).map((l: any, i: number) => (
        <div key={`l${i}`} data-testid="log-delta">
          <span className="inline-block px-1 rounded bg-slate-100 mr-1">log pattern</span>
          <span className="mono break-all">{String(l.pattern).slice(0, 140)}</span>:{" "}
          <b>
            {l.baseline} → {l.incident}
          </b>
          {l.example_trace && (
            <Link href={`/apm/trace/${l.example_trace}`} className="ml-2 text-primary hover:underline">
              trace →
            </Link>
          )}
        </div>
      ))}
      {d.latency
        .filter((r: any) => r.incident.p95_ns && r.baseline.p95_ns && r.incident.p95_ns > 1.5 * r.baseline.p95_ns)
        .slice(0, 2)
        .map((r: any, i: number) => (
          <div key={`p${i}`}>
            <span className="inline-block px-1 rounded bg-slate-100 mr-1">p95</span>
            <span className="mono">{r.resource}</span>: {ms(r.baseline.p95_ns)} → {ms(r.incident.p95_ns)}
          </div>
        ))}
    </div>
  );
}
function RelatedService({ service, since }: { service: string; since?: number }) {
  const { from, to, tick } = useTime();
  const errs = useQuery({
    queryKey: ["rel-spans", service, from, to, tick],
    queryFn: () =>
      api<{ spans: any[]; total: number; total_capped?: boolean }>("/ui/apm/spans", {
        body: { query: `service:${service} status:error`, from, to, limit: 200 },
      }),
  });
  const logs = useQuery({
    queryKey: ["rel-logs", service, from, to, tick],
    queryFn: () =>
      api<{ logs: any[]; total: number; total_capped?: boolean }>("/ui/logs/search", {
        body: { query: `service:${service} status:error`, from, to, limit: 3 },
      }),
  });
  // Most common failure among the recent error spans: error message + the operation (and DB statement if any).
  const top = useMemo(() => {
    const c = new Map<string, { n: number; span: any; msg: string; stmt?: string }>();
    for (const s of errs.data?.spans ?? []) {
      const meta = s.meta ?? {};
      const msg = String(
        meta["error.message"] ?? meta["exception.message"] ?? meta["error.msg"] ?? meta["otel.status_description"] ?? `${s.name} failed`,
      ).slice(0, 200);
      const stmt = meta["db.statement"] ?? meta["db.query.text"] ?? meta["sql.query"];
      const key = `${s.resource}|${msg}`;
      const e = c.get(key) ?? { n: 0, span: s, msg, stmt };
      e.n++;
      c.set(key, e);
    }
    return [...c.values()].sort((a, b) => b.n - a.n).slice(0, 3);
  }, [errs.data]);
  const fmtTotal = (d?: { total: number; total_capped?: boolean }) => (d ? `${fmtNum(d.total)}${d.total_capped ? "+" : ""}` : "…");
  return (
    <div className="border-t border-line first:border-t-0 px-4 py-3 text-xs space-y-2" data-testid="related-service">
      <div className="flex items-center gap-3">
        <Link href={`/apm/services/${encodeURIComponent(service)}`} className="font-semibold text-primary hover:underline" data-testid="related-service-link">
          {service}
        </Link>
        <Link
          href={`/apm/traces?query=${encodeURIComponent(`service:${service} status:error`)}`}
          className="text-ink-2 hover:text-primary hover:underline"
          data-testid="related-error-spans"
        >
          {fmtTotal(errs.data)} error spans
        </Link>
        <Link
          href={`/logs?query=${encodeURIComponent(`service:${service} status:error`)}`}
          className="text-ink-2 hover:text-primary hover:underline"
          data-testid="related-error-logs"
        >
          {fmtTotal(logs.data)} error logs
        </Link>
      </div>
      {top.map((t, i) => (
        <div key={i} className="bg-panel border border-line rounded p-2" data-testid="related-failure">
          <div className="flex gap-2">
            <span className="text-alert font-semibold">{t.n}×</span>
            <span className="mono">{t.span.resource}</span>
            <Link
              href={`/apm/trace/${t.span.trace_id}?span=${t.span.span_id}`}
              className="ml-auto text-primary hover:underline"
              data-testid="related-trace-link"
            >
              Example trace →
            </Link>
          </div>
          <div className="text-alert mt-1 break-all">{t.msg}</div>
          {t.stmt && (
            <div className="mono text-ink-2 mt-1 break-all" data-testid="related-statement">
              {String(t.stmt).slice(0, 300)}
            </div>
          )}
        </div>
      ))}
      {errs.data && !top.length && <div className="text-ink-3">No error spans for this service in the selected time range.</div>}
      {since && <WhatChanged service={service} since={since} />}
    </div>
  );
}
function RelatedTelemetry({ query, groups }: { query: string; groups: [string, any][] }) {
  const services = servicesOf(query, groups);
  if (!services.length) return null;
  return (
    <div className={cardStyles()} data-testid="related-telemetry">
      <div className="px-4 py-2 border-b border-line font-semibold">
        Related telemetry <span className="font-normal text-ink-3 text-xs">errors in the selected time range</span>
      </div>
      {services.map((s) => {
        const sinces = groups
          .filter(([k, g]) => g.state !== "OK" && (k.includes(`service:${s}`) || k === "*"))
          .map(([, g]) => g.since)
          .filter(Boolean);
        return <RelatedService key={s} service={s} since={sinces.length ? Math.min(...sinces) : undefined} />;
      })}
    </div>
  );
}

// ---------- Status page ----------
export function MonitorStatus() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const { from, to } = useTime();
  const m = useQuery({ queryKey: ["monitor", Number(id)], queryFn: () => api<Monitor>(`/v1/monitor/${id}`), refetchInterval: 10_000 });
  const hist = useQuery({
    queryKey: ["monitor-history", Number(id)],
    queryFn: () => api<{ events: any[]; notifications: any[] }>(`/ui/monitors/${id}/history`),
    refetchInterval: 10_000,
  });
  const f = m.data ? fromMonitor(m.data) : null;
  const mute = useMutation({
    mutationFn: (on: boolean) => api(`/v1/monitor/${id}/${on ? "mute" : "unmute"}`, { body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitor", Number(id)] }),
  });
  const del = useMutation({
    mutationFn: () => api(`/v1/monitor/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitors"] });
      nav("/monitors/manage");
    },
  });
  const evalNow = useMutation({
    mutationFn: () => api(`/ui/monitors/${id}/evaluate`, { body: {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitor", Number(id)] });
      qc.invalidateQueries({ queryKey: ["monitor-history", Number(id)] });
    },
  });
  // state timeline from events
  const timeline = useMemo(() => {
    const evs = [...(hist.data?.events ?? [])].sort((a, b) => a.ts - b.ts);
    const segs: { from: number; to: number; state: string }[] = [];
    let cur = "OK",
      start = from * 1000;
    for (const e of evs) {
      if (e.ts < from * 1000) {
        cur = e.alert_type === "error" ? "Alert" : e.alert_type === "warning" ? "Warn" : e.alert_type === "success" ? "OK" : "No Data";
        continue;
      }
      segs.push({ from: start, to: e.ts, state: cur });
      cur = e.alert_type === "error" ? "Alert" : e.alert_type === "warning" ? "Warn" : e.alert_type === "success" ? "OK" : "No Data";
      start = e.ts;
    }
    segs.push({ from: start, to: to * 1000, state: m.data?.overall_state ?? cur });
    return segs;
  }, [hist.data, from, to, m.data]);
  if (m.error) return <Empty title="Monitor not found" />;
  if (!m.data || !f) return <div className="p-6 text-ink-3">Loading…</div>;
  const muted = m.data.muted_until && m.data.muted_until * 1000 > Date.now();
  const groups = Object.entries(m.data.group_states ?? {}).sort(
    (a, b) => (({ Alert: 0, Warn: 1, "No Data": 2, OK: 3 }) as any)[a[1].state] - ({ Alert: 0, Warn: 1, "No Data": 2, OK: 3 } as any)[b[1].state],
  );
  const color: Record<string, string> = { OK: "#2ca05a", Alert: "#d33b4c", Warn: "#e8a317", "No Data": "#8b8fa3" };
  return (
    <div className="bg-panel min-h-full">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <StatusBadge state={m.data.overall_state} />
            {m.data.name}
          </span>
        }
      >
        <TimePicker />
        <Button onClick={() => evalNow.mutate()}>Evaluate now</Button>
        <Button onClick={() => mute.mutate(!muted)}>
          {muted ? (
            <>
              <Bell size={14} /> Unmute
            </>
          ) : (
            <>
              <BellOff size={14} /> Mute
            </>
          )}
        </Button>
        <Link href={`/monitors/${id}/edit`} className={buttonStyles()} data-testid="edit-monitor">
          <Pencil size={14} /> Edit
        </Link>
        <Link href={`/monitors/create?clone=${id}`} className={buttonStyles({ size: "icon" })} title="Clone">
          <Copy size={14} />
        </Link>
        <Button className="px-2 text-alert" title="Delete" onClick={() => confirm("Delete this monitor?") && del.mutate()}>
          <Trash2 size={14} />
        </Button>
      </PageHeader>
      <div className="p-6 space-y-4">
        <div className={cardStyles({ className: "p-4 space-y-2" })}>
          <div className="text-xs text-ink-3">Query</div>
          <div className="mono text-xs bg-panel border border-line rounded p-2 break-all" data-testid="monitor-query">
            {m.data.query}
          </div>
          <div className="flex gap-6 text-xs text-ink-2 pt-1">
            <span>Type: {TYPE_LABEL[m.data.type] ?? m.data.type}</span>
            <span>
              Alert: {f.op} {m.data.options?.thresholds?.critical}
            </span>
            {m.data.options?.thresholds?.warning !== undefined && (
              <span>
                Warn: {f.op} {m.data.options.thresholds.warning}
              </span>
            )}
            <span>Last triggered: {m.data.last_triggered_at ? fmtAgo(m.data.last_triggered_at) : "never"}</span>
            {muted && <span className="text-ink">Muted</span>}
          </div>
        </div>
        <div className={cardStyles({ className: "p-4" })}>
          <div className={sectionTitleStyles({ className: "mb-2" })}>Status history</div>
          <div className="flex h-5 rounded overflow-hidden">
            {timeline.map((s, i) => (
              <div key={i} title={`${s.state} from ${fmtTime(s.from, true)}`} style={{ flex: Math.max(1, s.to - s.from), background: color[s.state] }} />
            ))}
          </div>
          <div className="mt-3">
            <Preview f={f} />
          </div>
        </div>
        <RelatedTelemetry query={m.data.query} groups={groups} />
        <div className="grid grid-cols-2 gap-4">
          <div className={cardStyles()}>
            <div className="px-4 py-2 border-b border-line font-semibold">Groups ({groups.length})</div>
            <table className={tableStyles()}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Group</th>
                  <th className="!text-right">Value</th>
                  <th>Since</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([k, g]) => (
                  <tr key={k}>
                    <td>
                      <StatusBadge state={g.state} />
                    </td>
                    <td className="text-xs">{k === "*" ? "(all)" : k}</td>
                    <td className="text-right">{fmtNum(g.value)}</td>
                    <td className="text-ink-2 text-xs">{fmtAgo(g.since)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={cardStyles()}>
            <div className="px-4 py-2 border-b border-line font-semibold">Events & notifications</div>
            <div className="max-h-96 overflow-auto scroll-thin">
              {(hist.data?.events ?? []).map((e) => (
                <div key={e.id} className="px-4 py-2 border-b border-line text-xs" data-testid="monitor-event">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        background:
                          e.alert_type === "error"
                            ? color.Alert
                            : e.alert_type === "warning"
                              ? color.Warn
                              : e.alert_type === "success"
                                ? color.OK
                                : color["No Data"],
                      }}
                    />
                    <span className="font-semibold">{e.title}</span>
                    <span className="ml-auto text-ink-3">{fmtTime(e.ts, true)}</span>
                  </div>
                  <div className="whitespace-pre-wrap text-ink-2 mt-1">{e.text}</div>
                </div>
              ))}
              {(hist.data?.notifications ?? []).map((n) => (
                <div key={`n${n.id}`} className="px-4 py-1.5 border-b border-line text-xs flex gap-2" data-testid="monitor-notification">
                  <span className={n.status === "sent" ? "text-ok" : n.status === "failed" ? "text-alert" : "text-ink-3"}>● {n.status}</span>
                  <span className="mono">{n.channel}</span>
                  <span className="text-ink-3 truncate">{n.detail}</span>
                  <span className="ml-auto text-ink-3">{fmtTime(n.ts, true)}</span>
                </div>
              ))}
              {!hist.data?.events.length && <div className="px-4 py-3 text-xs text-ink-3">No state changes yet.</div>}
            </div>
          </div>
        </div>
        <div className={cardStyles({ className: "p-4" })}>
          <div className={sectionTitleStyles({ className: "mb-2" })}>Message</div>
          <pre className="mono text-xs whitespace-pre-wrap text-ink-2">{m.data.message}</pre>
        </div>
      </div>
    </div>
  );
}
