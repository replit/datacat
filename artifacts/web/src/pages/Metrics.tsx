import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader, TABS } from "@/components/Layout";
import { TimePicker } from "@/components/TimePicker";
import { TimeseriesChart } from "@/components/Chart";
import { QueryList, type QDef, type FDef } from "@/components/QueryEditor";
import { SidePanel } from "@/components/Panels";
import { useTime } from "@/lib/time";
import { fmtAgo } from "@/lib/format";
import { Input, badgeStyles, buttonStyles, cardStyles, labelStyles, sectionTitleStyles, tableStyles } from "@/components/ui";

export function MetricsExplorer() {
  const { from, to, tick } = useTime();
  const init = new URLSearchParams(location.search).get("q");
  const [queries, setQueries] = useState<QDef[]>([{ name: "a", query: init ?? "avg:system.cpu.user{*} by {host}" }]);
  const [formulas, setFormulas] = useState<FDef[]>([]);
  const [display, setDisplay] = useState<"line" | "area" | "bars">("line");
  const q = useQuery({
    queryKey: ["explorer", JSON.stringify(queries), JSON.stringify(formulas), from, to, tick],
    queryFn: () => api<{ series: any[]; interval: number }>("/ui/metrics/query", { body: { queries, formulas, from, to } }),
  });
  const series = (q.data?.series ?? []).map((s) => ({
    label: (s.alias ?? s.formula) + (s.group.length ? ` {${s.group.join(",")}}` : ""),
    points: s.pointlist,
  }));
  return (
    <div>
      <PageHeader title="Metrics" tabs={TABS.metrics}>
        <TimePicker />
      </PageHeader>
      <div className="p-6 space-y-4">
        <div className={cardStyles({ className: "p-4" })}>
          <div className="flex items-center mb-2">
            <div className="text-xs text-ink-3">
              Rollup interval: {q.data?.interval ?? "—"}s · {series.length} series
            </div>
            <div className="ml-auto flex">
              {(["line", "area", "bars"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDisplay(d)}
                  className={`h-7 px-3 border border-line -ml-px first:rounded-l last:rounded-r text-xs capitalize ${display === d ? "bg-primary text-white" : "bg-white"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          {q.error ? (
            <div className="text-alert text-xs p-4">{String((q.error as any).message)}</div>
          ) : (
            <TimeseriesChart series={series} type={display} height={340} from={from} to={to} showLegend={series.length > 1} />
          )}
        </div>
        <div className={cardStyles({ className: "p-4" })}>
          <div className={sectionTitleStyles({ className: "mb-3" })}>Graph</div>
          <QueryList
            queries={queries}
            formulas={formulas}
            onChange={(a, b) => {
              setQueries(a);
              setFormulas(b);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function MetricsSummary() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["metric-summary", q],
    queryFn: () => api<{ metrics: { metric: string; type: string; series: number; last_seen: number }[] }>(`/ui/metrics?q=${encodeURIComponent(q)}`),
  });
  const tags = useQuery({
    queryKey: ["metric-tags", sel],
    queryFn: () => api<{ tags: string[]; hosts: string[] }>(`/ui/metrics/${encodeURIComponent(sel!)}/tags`),
    enabled: !!sel,
  });
  return (
    <div>
      <PageHeader title="Metrics" tabs={TABS.metrics} sub={`${list.data?.metrics.length ?? 0} metrics`} />
      <div className="p-6">
        <div className="relative mb-3 max-w-md">
          <Search size={14} className="absolute left-2.5 top-2.5 text-ink-3" />
          <Input className="w-full pl-8" placeholder="Search metrics" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <table className={tableStyles({ className: "bg-white border border-line rounded-lg" })}>
          <thead>
            <tr>
              <th>Metric name</th>
              <th>Type</th>
              <th className="!text-right">Distinct series</th>
              <th>Last reported</th>
            </tr>
          </thead>
          <tbody>
            {(list.data?.metrics ?? []).map((m) => (
              <tr key={m.metric} className="cursor-pointer" onClick={() => setSel(m.metric)}>
                <td className="mono text-xs text-primary">{m.metric}</td>
                <td className="capitalize text-ink-2">{m.type}</td>
                <td className="text-right">{m.series}</td>
                <td className="text-ink-2">{fmtAgo(m.last_seen * 1000)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SidePanel open={!!sel} onClose={() => setSel(null)} title={<span className="mono">{sel}</span>}>
        <div className="p-5 space-y-4">
          <a className={buttonStyles({ variant: "primary" })} href={`/metric/explorer?q=${encodeURIComponent(`avg:${sel}{*}`)}`}>
            Open in Metrics Explorer
          </a>
          <div>
            <div className={labelStyles({ className: "mb-1" })}>Hosts ({tags.data?.hosts.length ?? 0})</div>
            <div className="flex flex-wrap gap-1">
              {tags.data?.hosts.map((h) => (
                <span key={h} className={badgeStyles()}>
                  {h}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className={labelStyles({ className: "mb-1" })}>Tags ({tags.data?.tags.length ?? 0})</div>
            <div className="flex flex-wrap gap-1">
              {tags.data?.tags.map((t) => (
                <span key={t} className={badgeStyles()}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </SidePanel>
    </div>
  );
}
