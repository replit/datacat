import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { Plus, Search, Star, Pencil, Save, X, Settings2, Download, Upload, Trash2, LayoutGrid } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { useAuthUser } from "@/lib/auth";
import { TimePicker } from "@/components/TimePicker";
import { Modal, Empty } from "@/components/Panels";
import { WidgetFrame, WidgetBody, WIDGET_TYPES, type WidgetDef } from "@/components/Widget";
import { QueryList, type QDef, type FDef } from "@/components/QueryEditor";
import { fmtAgo } from "@/lib/format";
import { Button, Input, Select, Textarea, cardStyles, cn, fieldStyles, labelStyles, tableStyles } from "@/components/ui";

const ROW_H = 92;

export function Avatar({ name }: { name?: string }) {
  const n = name || "?";
  const hue = [...n].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span
      className="inline-flex w-[18px] h-[18px] rounded-full items-center justify-center text-[10px] font-bold text-white shrink-0"
      style={{ background: `hsl(${hue} 45% 45%)` }}
    >
      {n[0]?.toUpperCase()}
    </span>
  );
}

export function recordView(id: string, title: string) {
  const r: Record<string, { t: number; n: number; title: string }> = JSON.parse(
    localStorage.getItem("datacat-views") ?? localStorage.getItem("dc-views") ?? "{}",
  );
  r[id] = { t: Date.now(), n: (r[id]?.n ?? 0) + 1, title };
  localStorage.setItem("dc-views", JSON.stringify(r));
}

export function DashboardList() {
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const search = useSearch();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(new URLSearchParams(search).get("new") === "1");
  const [title, setTitle] = useState("");
  const [importing, setImporting] = useState(false);
  const [json, setJson] = useState("");
  const [favs, setFavs] = useState<string[]>(() => JSON.parse(localStorage.getItem("datacat-favs") ?? localStorage.getItem("dc-favs") ?? "[]"));
  useEffect(() => {
    localStorage.setItem("dc-favs", JSON.stringify(favs));
  }, [favs]);
  const list = useQuery({ queryKey: ["dashboards"], queryFn: () => api<{ dashboards: any[] }>("/v1/dashboard") });
  const create = useMutation({
    mutationFn: (body: any) => api<any>("/v1/dashboard", { body }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["dashboards"] });
      nav(`/dashboard/${d.id}${d.widgets?.length ? "" : "?edit=1"}`);
    },
  });
  const [filter, setFilter] = useState("All");
  const { user } = useAuthUser();
  const views: Record<string, { t: number; n: number; title: string }> = JSON.parse(
    localStorage.getItem("datacat-views") ?? localStorage.getItem("dc-views") ?? "{}",
  );
  const all = list.data?.dashboards ?? [];
  const mine = (d: any) => !!user && [user.firstName, user.email, [user.firstName, user.lastName].filter(Boolean).join(" ")].includes(d.author_name);
  const filters: [string, (d: any) => boolean][] = [
    ["All", () => true],
    ["Favorites", (d) => favs.includes(d.id)],
    ["Created by me", mine],
    ["Recently viewed", (d) => !!views[d.id]],
  ];
  const ff = filters.find((f) => f[0] === filter)?.[1] ?? (() => true);
  const rows = all.filter((d) => ff(d) && `${d.title} ${d.description ?? ""} ${d.author_name ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  if (filter === "Recently viewed") rows.sort((a, b) => views[b.id].t - views[a.id].t);
  const recent = all
    .filter((d) => views[d.id])
    .sort((a, b) => views[b.id].t - views[a.id].t)
    .slice(0, 4);
  const toggleFav = (id: string) => setFavs(favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id]);
  return (
    <div className="min-h-full">
      <PageHeader title="Dashboards">
        <Button onClick={() => setImporting(true)}>
          <Upload size={14} /> Import JSON
        </Button>
        <Button variant="primary" onClick={() => setCreating(true)} data-testid="new-dashboard">
          <Plus size={14} /> New Dashboard
        </Button>
      </PageHeader>
      <div className="px-6 py-5 space-y-6">
        {recent.length > 0 && !q && filter === "All" && (
          <section>
            <h2 className="text-[13px] font-semibold text-ink-2 mb-2">Recently viewed</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {recent.map((d) => (
                <Link
                  key={d.id}
                  href={`/dashboard/${d.id}`}
                  className={cardStyles({ className: "p-3.5 hover:border-brand-400 hover:shadow-sm transition-shadow" })}
                >
                  <div className="flex items-center gap-2">
                    <LayoutGrid size={15} className="text-primary shrink-0" />
                    <span className="text-[14px] font-medium truncate">{d.title}</span>
                  </div>
                  <div className="text-[12px] text-ink-3 mt-1.5 truncate">
                    {d.widget_count} widgets · viewed {fmtAgo(views[d.id].t)}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-subtle border border-line">
              {filters.map(([f, fn]) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "h-7 px-3 rounded-md text-[13px] flex items-center gap-1.5 transition-colors",
                    filter === f ? "bg-white text-ink font-medium shadow-sm" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {f}
                  <span className="text-[11px] text-ink-3">{all.filter(fn).length}</span>
                </button>
              ))}
            </div>
            <div className="relative ml-auto w-72">
              <Search size={14} className="absolute left-2.5 top-2 text-ink-3" />
              <Input className="w-full pl-8" placeholder="Search by name, description or owner" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          {rows.length === 0 && !list.isLoading ? (
            <div className={cardStyles()}>
              {all.length === 0 ? (
                <Empty title="No dashboards yet">Create a dashboard to graph metrics from your hosts, services and logs.</Empty>
              ) : (
                <Empty title="Nothing here">{filter === "Favorites" ? "Star a dashboard to pin it here." : "No dashboards match this filter."}</Empty>
              )}
            </div>
          ) : (
            <div className={cardStyles({ className: "overflow-hidden" })}>
              <table className={tableStyles({ className: "[&_td]:h-[52px] [&_th]:bg-panel" })}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="w-48">Owner</th>
                    <th className="w-24">Widgets</th>
                    <th className="w-36">Last modified</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => {
                    const fav = favs.includes(d.id);
                    return (
                      <tr key={d.id} className="group cursor-pointer" onClick={() => nav(`/dashboard/${d.id}`)}>
                        <td>
                          <Link href={`/dashboard/${d.id}`} className="block min-w-0" onClick={(e) => e.stopPropagation()}>
                            <div className="text-ink font-medium group-hover:text-primary truncate">{d.title}</div>
                            {d.description && <div className="text-[12px] text-ink-3 truncate">{d.description}</div>}
                          </Link>
                        </td>
                        <td className="text-ink-2">
                          <span className="inline-flex items-center gap-2">
                            <Avatar name={d.author_name} />
                            <span className="truncate">{d.author_name || "Unknown"}</span>
                          </span>
                        </td>
                        <td className="text-ink-2">{d.widget_count}</td>
                        <td className="text-ink-2" title={new Date(d.modified_at).toLocaleString()}>
                          {fmtAgo(new Date(d.modified_at).getTime())}
                        </td>
                        <td className="text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFav(d.id);
                            }}
                            aria-label={fav ? "Remove from favorites" : "Add to favorites"}
                            title={fav ? "Remove from favorites" : "Add to favorites"}
                            className={cn("p-1 rounded hover:bg-subtle", fav ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100")}
                          >
                            <Star size={15} className={fav ? "fill-accent text-accent" : "text-ink-3"} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create a Dashboard"
        width={520}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!title}
              onClick={() => create.mutate({ title, layout_type: "ordered", widgets: [] })}
              data-testid="create-dashboard"
            >
              New Dashboard
            </Button>
          </>
        }
      >
        <div className="p-5 space-y-2">
          <label className={labelStyles()}>Dashboard name</label>
          <Input
            autoFocus
            className="w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Web tier overview"
            data-testid="dashboard-name"
            onKeyDown={(e) => e.key === "Enter" && title && create.mutate({ title, layout_type: "ordered", widgets: [] })}
          />
        </div>
      </Modal>
      <Modal
        open={importing}
        onClose={() => setImporting(false)}
        title="Import dashboard JSON"
        width={720}
        footer={
          <>
            <Button onClick={() => setImporting(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                try {
                  const j = JSON.parse(json);
                  create.mutate({
                    title: j.title ?? "Imported dashboard",
                    description: j.description,
                    layout_type: j.layout_type ?? "ordered",
                    widgets: j.widgets ?? [],
                    template_variables: j.template_variables ?? [],
                  });
                } catch {
                  alert("Invalid JSON");
                }
              }}
            >
              Import
            </Button>
          </>
        }
      >
        <div className="p-5">
          <p className="text-ink-2 mb-2">
            Paste a dashboard definition (JSON with <span className="mono">widgets</span> and <span className="mono">template_variables</span>).
          </p>
          <Textarea className="w-full h-80 mono text-xs py-2" value={json} onChange={(e) => setJson(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}

function autoLayout(widgets: WidgetDef[]): WidgetDef[] {
  // fill missing layouts: pack left-to-right on a 12 col grid
  let x = 0,
    y = 0,
    rowH = 0;
  for (const w of widgets) {
    if (w.layout) {
      y = Math.max(y, w.layout.y);
      continue;
    }
  }
  const maxY = widgets.reduce((m, w) => (w.layout ? Math.max(m, w.layout.y + w.layout.height) : m), 0);
  y = maxY;
  for (const w of widgets) {
    if (w.layout) continue;
    const width = w.definition.type === "group" ? 12 : w.definition.type === "query_value" ? 2 : w.definition.type === "note" ? 3 : 4;
    const height = w.definition.type === "group" ? 4 : w.definition.type === "query_value" ? 2 : 2;
    if (x + width > 12) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    w.layout = { x, y, width, height };
    x += width;
    rowH = Math.max(rowH, height);
  }
  return widgets;
}

function Grid({
  widgets,
  vars,
  editing,
  onEdit,
  onClone,
  onDelete,
  onMove,
}: {
  widgets: WidgetDef[];
  vars: Record<string, string>;
  editing: boolean;
  onEdit: (i: number) => void;
  onClone: (i: number) => void;
  onDelete: (i: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const rows = widgets.reduce((m, w) => Math.max(m, (w.layout?.y ?? 0) + (w.layout?.height ?? 2)), 1);
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridTemplateRows: `repeat(${rows}, ${ROW_H}px)` }}>
      {widgets.map((w, i) => {
        const l = w.layout ?? { x: 0, y: 0, width: 4, height: 2 };
        return (
          <div
            key={w.id ?? i}
            style={{ gridColumn: `${l.x + 1} / span ${Math.min(12, l.width)}`, gridRow: `${l.y + 1} / span ${l.height}` }}
            draggable={editing}
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => editing && e.preventDefault()}
            onDrop={() => {
              if (dragIdx !== null && dragIdx !== i) onMove(dragIdx, i);
              setDragIdx(null);
            }}
            className={editing ? "cursor-move outline-dashed outline-1 outline-primary rounded" : ""}
          >
            <WidgetFrame w={w} vars={vars} editing={editing} onEdit={() => onEdit(i)} onClone={() => onClone(i)} onDelete={() => onDelete(i)}>
              {w.definition.type === "group" && (
                <div className="grid gap-2 h-full" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoRows: `${ROW_H - 10}px` }}>
                  {autoLayout(w.definition.widgets ?? []).map((c: WidgetDef, j: number) => (
                    <div
                      key={c.id ?? j}
                      style={{
                        gridColumn: `${(c.layout?.x ?? 0) + 1} / span ${Math.min(12, c.layout?.width ?? 4)}`,
                        gridRow: `${(c.layout?.y ?? 0) + 1} / span ${c.layout?.height ?? 2}`,
                      }}
                    >
                      <WidgetFrame w={c} vars={vars} />
                    </div>
                  ))}
                </div>
              )}
            </WidgetFrame>
          </div>
        );
      })}
    </div>
  );
}

const SIZES: Record<string, [number, number]> = { S: [3, 2], M: [4, 2], L: [6, 3], XL: [12, 3] };

export function WidgetEditor({ initial, onSave, onClose }: { initial: WidgetDef | null; onSave: (w: WidgetDef) => void; onClose: () => void }) {
  const init = initial?.definition ?? {
    type: "timeseries",
    requests: [
      { queries: [{ name: "a", data_source: "metrics", query: "avg:system.cpu.user{*} by {host}" }], response_format: "timeseries", display_type: "line" },
    ],
  };
  const [type, setType] = useState<string>(init.type);
  const [title, setTitle] = useState<string>(init.title ?? "");
  const [content, setContent] = useState<string>(init.content ?? init.text ?? "");
  const req = init.requests?.[0] ?? {};
  const [queries, setQueries] = useState<QDef[]>(
    req.queries ?? (req.q ? [{ name: "a", query: req.q }] : [{ name: "a", data_source: "metrics", query: "avg:system.cpu.user{*} by {host}" }]),
  );
  const [formulas, setFormulas] = useState<FDef[]>(req.formulas ?? []);
  const [display, setDisplay] = useState<string>(req.display_type ?? "line");
  const [palette, setPalette] = useState<string>(req.style?.palette ?? "classic");
  const [aggregator, setAggregator] = useState<string>(req.queries?.[0]?.aggregator ?? "avg");
  const [logQuery, setLogQuery] = useState<string>(req.query?.query_string ?? "*");
  const [size, setSize] = useState<string>(() => {
    const l = initial?.layout;
    if (!l) return type === "query_value" ? "S" : "M";
    return Object.entries(SIZES).find(([, v]) => v[0] === l.width)?.[0] ?? "M";
  });
  const [color, setColor] = useState<string>(init.background_color ?? "vivid_purple");
  const [condWarn, setCondWarn] = useState<string>(String(req.conditional_formats?.find((c: any) => String(c.palette).includes("yellow"))?.value ?? ""));
  const [condCrit, setCondCrit] = useState<string>(String(req.conditional_formats?.find((c: any) => String(c.palette).includes("red"))?.value ?? ""));

  const def = useMemo(() => {
    const qs = queries.map((q) => ({ ...q, data_source: "metrics", ...(type !== "timeseries" ? { aggregator } : {}) }));
    const base: any = { type, title: title || undefined };
    if (type === "note") return { type, content, background_color: "white", font_size: "14", text_align: "left" };
    if (type === "group") return { type, title, layout_type: "ordered", background_color: color, widgets: init.widgets ?? [] };
    if (type === "list_stream")
      return { ...base, requests: [{ response_format: "event_list", query: { data_source: "logs_stream", query_string: logQuery } }] };
    if (type === "manage_status") return { ...base, query: logQuery === "*" ? "" : logQuery, summary_type: "monitors" };
    const r: any = { queries: qs, formulas: formulas.length ? formulas : undefined, response_format: type === "timeseries" ? "timeseries" : "scalar" };
    if (type === "timeseries") {
      r.display_type = display;
      r.style = { palette, line_type: "solid", line_width: "normal" };
    }
    if (type === "query_value") {
      const cf: any[] = [];
      if (condCrit !== "") cf.push({ comparator: ">", value: Number(condCrit), palette: "white_on_red" });
      if (condWarn !== "") cf.push({ comparator: ">", value: Number(condWarn), palette: "white_on_yellow" });
      if (cf.length) cf.push({ comparator: "<=", value: Number(condWarn || condCrit), palette: "white_on_green" });
      r.conditional_formats = cf.length ? cf : undefined;
      base.precision = 2;
    }
    return { ...base, requests: [r] };
  }, [type, title, content, queries, formulas, display, palette, aggregator, logQuery, color, condCrit, condWarn]);

  const save = () => {
    const [w, h] = type === "group" ? [12, 4] : SIZES[size];
    onSave({
      id: initial?.id,
      definition: def,
      layout: initial?.layout
        ? { ...initial.layout, width: w, height: type === "group" ? initial.layout.height : h }
        : ({ x: -1, y: -1, width: w, height: h } as any),
    });
  };
  const isMetric = ["timeseries", "query_value", "toplist", "query_table"].includes(type);
  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "Edit widget" : "Add widget"}
      width={1080}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} data-testid="save-widget">
            Save
          </Button>
        </>
      }
    >
      <div className="bg-panel border-b border-line p-4">
        <div className={cardStyles({ className: "p-2 h-[230px] flex flex-col" })}>
          <div className="text-[13px] font-medium px-1 pb-1">{title || (WIDGET_TYPES.find((t) => t.type === type)?.label ?? "")}</div>
          <div className="flex-1 min-h-0">
            {type === "group" ? (
              <div className="text-ink-3 text-xs p-4">Groups organize widgets into collapsible sections.</div>
            ) : (
              <WidgetBody def={def} vars={{}} />
            )}
          </div>
        </div>
      </div>
      <div className="p-5 space-y-6">
        <section>
          <div className="text-[15px] font-semibold mb-2.5 flex items-center">
            <span className="inline-flex w-6 h-6 rounded-full bg-subtle text-ink text-[12px] font-bold items-center justify-center mr-2.5">1</span>Select your
            visualization
          </div>
          <div className="flex flex-wrap gap-2">
            {WIDGET_TYPES.map((t) => (
              <button
                key={t.type}
                onClick={() => setType(t.type)}
                className={`px-3 h-9 rounded-[3px] border text-[13px] ${type === t.type ? "border-primary bg-brand-100 text-primary font-semibold" : "border-line-strong hover:bg-canvas"}`}
                data-testid={`viz-${t.type}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>
        <section>
          <div className="text-[15px] font-semibold mb-2.5 flex items-center">
            <span className="inline-flex w-6 h-6 rounded-full bg-subtle text-ink text-[12px] font-bold items-center justify-center mr-2.5">2</span>
            {type === "note" ? "Write your note" : "Graph your data"}
          </div>
          {isMetric && (
            <QueryList
              queries={queries}
              formulas={formulas}
              onChange={(q, f) => {
                setQueries(q);
                setFormulas(f);
              }}
            />
          )}
          {type === "note" && (
            <Textarea className="w-full h-32 py-2" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Markdown-style text" />
          )}
          {(type === "list_stream" || type === "manage_status") && (
            <Input
              className="w-full mono text-xs"
              value={logQuery}
              onChange={(e) => setLogQuery(e.target.value)}
              placeholder={type === "list_stream" ? "service:web status:error" : "monitor name filter"}
            />
          )}
          {type === "group" && (
            <Select value={color} onChange={(e) => setColor(e.target.value)}>
              {["vivid_purple", "vivid_blue", "vivid_green", "vivid_orange", "vivid_pink", "vivid_yellow", "purple", "blue", "green", "gray"].map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ")}
                </option>
              ))}
            </Select>
          )}
        </section>
        <section>
          <div className="text-[15px] font-semibold mb-2.5 flex items-center">
            <span className="inline-flex w-6 h-6 rounded-full bg-subtle text-ink text-[12px] font-bold items-center justify-center mr-2.5">3</span>Set display
            preferences
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            {type === "timeseries" && (
              <>
                <div>
                  <div className={labelStyles({ className: "mb-1" })}>Display</div>
                  <Select value={display} onChange={(e) => setDisplay(e.target.value)}>
                    <option value="line">Lines</option>
                    <option value="area">Areas</option>
                    <option value="bars">Bars</option>
                  </Select>
                </div>
                <div>
                  <div className={labelStyles({ className: "mb-1" })}>Palette</div>
                  <Select value={palette} onChange={(e) => setPalette(e.target.value)}>
                    <option value="classic">Classic</option>
                    <option value="cool">Cool</option>
                    <option value="warm">Warm</option>
                  </Select>
                </div>
              </>
            )}
            {type !== "timeseries" && isMetric && (
              <div>
                <div className={labelStyles({ className: "mb-1" })}>Aggregate by</div>
                <Select value={aggregator} onChange={(e) => setAggregator(e.target.value)}>
                  {["avg", "sum", "min", "max", "last"].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </Select>
              </div>
            )}
            {type === "query_value" && (
              <>
                <div>
                  <div className={labelStyles({ className: "mb-1" })}>Yellow above</div>
                  <Input className="w-24" value={condWarn} onChange={(e) => setCondWarn(e.target.value)} />
                </div>
                <div>
                  <div className={labelStyles({ className: "mb-1" })}>Red above</div>
                  <Input className="w-24" value={condCrit} onChange={(e) => setCondCrit(e.target.value)} />
                </div>
              </>
            )}
            {type !== "group" && (
              <div>
                <div className={labelStyles({ className: "mb-1" })}>Size</div>
                <div className="flex">
                  {Object.keys(SIZES).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`h-8 w-9 border border-line -ml-px first:ml-0 first:rounded-l last:rounded-r text-xs ${size === s ? "bg-primary text-white border-primary" : "bg-white"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
        {type !== "note" && (
          <section>
            <div className="text-[15px] font-semibold mb-2.5 flex items-center">
              <span className="inline-flex w-6 h-6 rounded-full bg-subtle text-ink text-[12px] font-bold items-center justify-center mr-2.5">4</span>Graph title
            </div>
            <Input className="w-full max-w-lg" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a title" data-testid="widget-title" />
          </section>
        )}
      </div>
    </Modal>
  );
}

function placeWidget(widgets: WidgetDef[], w: WidgetDef): WidgetDef {
  if (w.layout && w.layout.x >= 0) return w;
  const width = w.layout?.width ?? 4,
    height = w.layout?.height ?? 2;
  const occ = new Set<string>();
  for (const o of widgets)
    if (o.layout)
      for (let x = o.layout.x; x < o.layout.x + o.layout.width; x++) for (let y = o.layout.y; y < o.layout.y + o.layout.height; y++) occ.add(`${x},${y}`);
  for (let y = 0; y < 500; y++)
    for (let x = 0; x + width <= 12; x++) {
      let ok = true;
      for (let dx = 0; dx < width && ok; dx++) for (let dy = 0; dy < height && ok; dy++) if (occ.has(`${x + dx},${y + dy}`)) ok = false;
      if (ok) return { ...w, layout: { x, y, width, height } };
    }
  return { ...w, layout: { x: 0, y: 0, width, height } };
}

export function DashboardView() {
  const { id } = useParams<{ id: string }>();
  const search = useSearch();
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const dq = useQuery({ queryKey: ["dashboard", id], queryFn: () => api<any>(`/v1/dashboard/${id}`) });
  const [editing, setEditing] = useState(new URLSearchParams(search).get("edit") === "1");
  const [draft, setDraft] = useState<any>(null);
  const [editIdx, setEditIdx] = useState<number | null | "new">(null);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [showJson, setShowJson] = useState(false);
  const [settings, setSettings] = useState(false);
  const [tab, setTab] = useState(0);
  const [favs, setFavs] = useState<string[]>(() => JSON.parse(localStorage.getItem("datacat-favs") ?? localStorage.getItem("dc-favs") ?? "[]"));
  const isFav = favs.includes(id);
  const toggleFav = (x: string) => {
    const n = favs.includes(x) ? favs.filter((y) => y !== x) : [...favs, x];
    setFavs(n);
    localStorage.setItem("dc-favs", JSON.stringify(n));
  };
  useEffect(() => {
    if (dq.data) recordView(id, dq.data.title);
  }, [dq.data?.id]);
  useEffect(() => {
    if (dq.data && !draft) {
      setDraft(structuredClone(dq.data));
      const v: Record<string, string> = {};
      for (const t of dq.data.template_variables ?? []) v[t.name] = t.default ?? "*";
      setVars(v);
    }
  }, [dq.data]);
  const tagVals = useQuery({
    queryKey: ["all-tags"],
    queryFn: () => api<{ tags: string[]; hosts: string[] }>("/ui/tags"),
    enabled: (draft?.template_variables ?? []).length > 0,
  });
  const save = useMutation({
    mutationFn: (d: any) =>
      api<any>(`/v1/dashboard/${id}`, {
        method: "PUT",
        body: { title: d.title, description: d.description, layout_type: d.layout_type, widgets: d.widgets, template_variables: d.template_variables },
      }),
    onSuccess: (d) => {
      setDraft(structuredClone(d));
      qc.setQueryData(["dashboard", id], d);
      qc.invalidateQueries({ queryKey: ["dashboards"] });
      setEditing(false);
    },
  });
  const del = useMutation({
    mutationFn: () => api(`/v1/dashboard/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboards"] });
      nav("/dashboard/lists");
    },
  });
  if (dq.error) return <Empty title="Dashboard not found" />;
  if (!draft) return <div className="p-6 text-ink-3">Loading…</div>;
  const allWidgets: WidgetDef[] = autoLayout(draft.widgets ?? []);
  // Like sectioned dashboards: when every top-level widget is a group (and there are 2+), each group becomes a tab.
  const groupTabs =
    allWidgets.length > 1 && allWidgets.every((w) => w.definition.type === "group")
      ? allWidgets.map((w) => ({ title: String(w.definition.title ?? "Group").split(" · ")[0], w }))
      : [];
  const widgets: WidgetDef[] = allWidgets;
  const cur = groupTabs[Math.min(tab, groupTabs.length - 1)];
  const shown: WidgetDef[] = cur && !editing ? [{ ...cur.w, layout: { ...cur.w.layout!, x: 0, y: 0, width: 12 } }] : widgets;
  const update = (ws: WidgetDef[]) => setDraft({ ...draft, widgets: ws });
  const tvValues = (prefix: string) => {
    const all = [...(tagVals.data?.tags ?? []), ...(tagVals.data?.hosts ?? []).map((h) => `host:${h}`)];
    return [...new Set(all.filter((t) => t.startsWith(prefix + ":")).map((t) => t.slice(prefix.length + 1)))];
  };
  return (
    <div className="min-h-full">
      <div className="flex flex-wrap items-center gap-2 px-5 py-2 min-h-[50px] border-b border-line bg-white sticky top-0 z-20">
        <div className="flex flex-[1_1_18rem] min-w-0 items-center gap-2">
          {editing ? (
            <Input className="text-[16px] font-semibold min-w-0 w-96" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          ) : (
            <h1 className="text-[18px] font-semibold truncate shrink-0 max-w-[calc(100%-25px)]" title={draft.title}>
              {draft.title}
            </h1>
          )}
          {draft.description && !editing && (
            <span className="text-ink-3 text-xs truncate max-w-[320px]" title={draft.description}>
              {draft.description}
            </span>
          )}
        </div>
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1.5 whitespace-nowrap">
          {editing ? (
            <>
              <Button
                onClick={() => {
                  setDraft(structuredClone(dq.data));
                  setEditing(false);
                }}
              >
                <X size={14} /> Cancel
              </Button>
              <Button onClick={() => setEditIdx("new")} data-testid="add-widget">
                <Plus size={14} /> Add Widget
              </Button>
              <Button variant="primary" onClick={() => save.mutate(draft)} disabled={save.isPending} data-testid="save-dashboard">
                <Save size={14} /> Save
              </Button>
            </>
          ) : (
            <>
              <Button className="border-transparent" title="Export JSON" onClick={() => setShowJson(true)}>
                <Download size={14} /> Export
              </Button>
              <Button className="border-transparent" title="Settings" onClick={() => setSettings(true)}>
                <Settings2 size={14} /> Configure
              </Button>
              <Button onClick={() => setEditing(true)} data-testid="edit-dashboard">
                <Pencil size={14} /> Edit Widgets
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(true);
                  setEditIdx("new");
                }}
                data-testid="add-widgets"
              >
                <Plus size={14} /> Add Widgets
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2 px-5 py-2 bg-white border-b border-line">
        {(draft.template_variables ?? []).length > 0 && <span className="text-[12px] text-ink-2 pb-1.5">Filter by:</span>}
        {(draft.template_variables ?? []).map((t: any) => (
          <label key={t.name} className="flex flex-col gap-0.5 text-[11px] text-ink-2">
            <span className="px-0.5">{t.name}</span>
            <select
              className={fieldStyles({ className: cn("h-7 w-40 text-[12px]", (vars[t.name] ?? "*") !== "*" && "border-primary bg-brand-50") })}
              value={vars[t.name] ?? "*"}
              onChange={(e) => setVars({ ...vars, [t.name]: e.target.value })}
              data-testid={`tv-${t.name}`}
            >
              <option value="*">*</option>
              {[...new Set([...(t.available_values ?? []), ...tvValues(t.prefix ?? t.name), t.default].filter((x: any) => x && x !== "*"))].map((v: string) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        ))}
        <div className="ml-auto">
          <TimePicker />
        </div>
      </div>
      {groupTabs.length > 1 && !editing && (
        <div className="flex px-5 bg-white border-b border-line">
          {groupTabs
            .map((g) => g.title)
            .map((t, i) => (
              <button
                key={i}
                onClick={() => setTab(i)}
                className={`px-4 h-10 text-[13px] border-b-2 -mb-px ${tab === i ? "border-primary text-ink font-semibold" : "border-transparent text-ink-2 hover:text-ink"}`}
                data-testid="dash-tab"
              >
                {t}
              </button>
            ))}
        </div>
      )}
      <div className="p-4">
        {widgets.length === 0 ? (
          <div className={cardStyles({ className: "p-10 text-center" })}>
            <LayoutGrid size={28} className="mx-auto text-brand-400 mb-2" />
            <div className="font-semibold mb-1">Add your first widget</div>
            <div className="text-ink-2 mb-3">Graph metrics, show top lists, values, logs, or monitor status.</div>
            <Button
              variant="primary"
              onClick={() => {
                setEditing(true);
                setEditIdx("new");
              }}
              data-testid="add-first-widget"
            >
              <Plus size={14} /> Add Widget
            </Button>
          </div>
        ) : (
          <Grid
            widgets={shown}
            vars={Object.fromEntries(
              (draft.template_variables ?? []).map((t: any) => [t.name, (vars[t.name] ?? "*") === "*" ? "*" : `${t.prefix ?? t.name}:${vars[t.name]}`]),
            )}
            editing={editing}
            onEdit={(i) => {
              if (!editing) setEditing(true);
              setEditIdx(i);
            }}
            onClone={(i) =>
              update([
                ...widgets,
                placeWidget(widgets, { definition: structuredClone(widgets[i].definition), layout: { ...widgets[i].layout!, x: -1, y: -1 } }),
              ])
            }
            onDelete={(i) => {
              if (!editing) setEditing(true);
              update(widgets.filter((_, j) => j !== i));
            }}
            onMove={(a, b) => {
              const ws = widgets.map((w) => ({ ...w }));
              const la = ws[a].layout!,
                lb = ws[b].layout!;
              ws[a].layout = { ...lb, width: la.width, height: la.height };
              ws[b].layout = { ...la, width: lb.width, height: lb.height };
              update(ws);
            }}
          />
        )}
      </div>
      {editIdx !== null && (
        <WidgetEditor
          initial={editIdx === "new" ? null : widgets[editIdx]}
          onClose={() => setEditIdx(null)}
          onSave={(w) => {
            if (editIdx === "new") update([...widgets, placeWidget(widgets, w)]);
            else
              update(
                widgets.map((x, j) =>
                  j === editIdx
                    ? { ...w, layout: w.layout && w.layout.x >= 0 ? w.layout : { ...x.layout!, width: w.layout!.width, height: w.layout!.height } }
                    : x,
                ),
              );
            setEditIdx(null);
            if (!editing) setEditing(true);
          }}
        />
      )}
      <Modal open={showJson} onClose={() => setShowJson(false)} title="Dashboard JSON" width={760}>
        <pre className="p-4 mono text-xs whitespace-pre-wrap">
          {JSON.stringify(
            {
              title: draft.title,
              description: draft.description,
              layout_type: draft.layout_type,
              template_variables: draft.template_variables,
              widgets: draft.widgets,
            },
            null,
            2,
          )}
        </pre>
      </Modal>
      <Modal
        open={settings}
        onClose={() => setSettings(false)}
        title="Dashboard settings"
        width={620}
        footer={
          <>
            <Button className="text-alert" onClick={() => confirm("Delete this dashboard?") && del.mutate()}>
              <Trash2 size={14} /> Delete dashboard
            </Button>
            <div className="flex-1" />
            <Button onClick={() => setSettings(false)}>Close</Button>
            <Button
              variant="primary"
              onClick={() => {
                save.mutate(draft);
                setSettings(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="p-5 space-y-4">
          <div>
            <div className={labelStyles({ className: "mb-1" })}>Description</div>
            <Textarea className="w-full h-20 py-2" value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div>
            <div className={labelStyles({ className: "mb-1" })}>Template variables</div>
            {(draft.template_variables ?? []).map((t: any, i: number) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input
                  className="w-32"
                  value={t.name}
                  placeholder="name"
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      template_variables: draft.template_variables.map((x: any, j: number) => (j === i ? { ...x, name: e.target.value } : x)),
                    })
                  }
                />
                <Input
                  className="w-32"
                  value={t.prefix ?? ""}
                  placeholder="tag key"
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      template_variables: draft.template_variables.map((x: any, j: number) => (j === i ? { ...x, prefix: e.target.value } : x)),
                    })
                  }
                />
                <Input
                  className="w-32"
                  value={t.default ?? ""}
                  placeholder="default"
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      template_variables: draft.template_variables.map((x: any, j: number) => (j === i ? { ...x, default: e.target.value } : x)),
                    })
                  }
                />
                <Button
                  className="px-2"
                  onClick={() => setDraft({ ...draft, template_variables: draft.template_variables.filter((_: any, j: number) => j !== i) })}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              onClick={() => setDraft({ ...draft, template_variables: [...(draft.template_variables ?? []), { name: "host", prefix: "host", default: "*" }] })}
            >
              <Plus size={12} /> Add variable
            </Button>
            <p className="text-xs text-ink-3 mt-1">
              Use <span className="mono">$name</span> in a query filter, e.g. <span className="mono">{"avg:system.cpu.user{$host}"}</span>.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
