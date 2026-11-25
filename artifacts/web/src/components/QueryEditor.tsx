import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Code2, Trash2, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Input, Select, badgeStyles, fieldStyles } from "@/components/ui";

export interface QDef {
  name: string;
  query: string;
  data_source?: string;
}
export interface FDef {
  formula: string;
  alias?: string;
}

const AGGS = ["avg", "sum", "min", "max", "count"];

function parse(q: string) {
  const m = /^(avg|sum|min|max|count):([A-Za-z0-9_.]*)\{([^}]*)\}(?:\s+by\s+\{([^}]*)\})?(.*)$/.exec(q.trim());
  if (!m) return null;
  return {
    agg: m[1],
    metric: m[2],
    from:
      m[3] === "*"
        ? []
        : m[3]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
    by: m[4]
      ? m[4]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    rest: m[5] ?? "",
  };
}
function build(p: { agg: string; metric: string; from: string[]; by: string[]; rest: string }) {
  return `${p.agg}:${p.metric || "system.cpu.user"}{${p.from.length ? p.from.join(",") : "*"}}${p.by.length ? ` by {${p.by.join(",")}}` : ""}${p.rest}`;
}

export function useMetricNames() {
  return useQuery({ queryKey: ["metric-names"], queryFn: () => api<{ metrics: { metric: string }[] }>("/ui/metrics"), staleTime: 30_000 });
}

function TagPicker({ value, onChange, options, placeholder }: { value: string[]; onChange: (v: string[]) => void; options: string[]; placeholder: string }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = options.filter((o) => o.toLowerCase().includes(text.toLowerCase()) && !value.includes(o)).slice(0, 30);
  return (
    <div className="relative flex-1 min-w-[160px]">
      <div className={fieldStyles({ className: "h-auto min-h-8 flex flex-wrap gap-1 items-center py-1" })} onClick={() => setOpen(true)}>
        {value.map((v) => (
          <span key={v} className={badgeStyles({ tone: "brand" })}>
            {v}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((x) => x !== v));
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[60px] outline-none text-[13px]"
          placeholder={value.length ? "" : placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              onChange([...value, text.trim()]);
              setText("");
            }
            if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 card shadow-lg max-h-56 overflow-auto z-50">
          {filtered.map((o) => (
            <button
              key={o}
              className="block w-full text-left px-2.5 py-1 text-xs hover:bg-brand-100"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange([...value, o]);
                setText("");
              }}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const names = useMetricNames();
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  useEffect(() => setText(value), [value]);
  const list = (names.data?.metrics ?? [])
    .map((m) => m.metric)
    .filter((m) => m.toLowerCase().includes(text.toLowerCase()))
    .slice(0, 50);
  return (
    <div className="relative w-[280px]">
      <Input
        className="w-full mono text-xs"
        value={text}
        placeholder="metric name"
        data-testid="metric-picker"
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() =>
          setTimeout(() => {
            setOpen(false);
            if (text && text !== value) onChange(text);
          }, 150)
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onChange(text);
            setOpen(false);
          }
        }}
      />
      {open && list.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 card shadow-lg max-h-64 overflow-auto z-50">
          {list.map((m) => (
            <button
              key={m}
              className="block w-full text-left px-2.5 py-1 text-xs mono hover:bg-brand-100"
              onMouseDown={(e) => {
                e.preventDefault();
                setText(m);
                onChange(m);
                setOpen(false);
              }}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MetricQueryRow({ q, onChange, onRemove, color }: { q: QDef; onChange: (q: QDef) => void; onRemove?: () => void; color?: string }) {
  const parsed = useMemo(() => parse(q.query), [q.query]);
  const [raw, setRaw] = useState(!parsed && !!q.query);
  const p = parsed ?? { agg: "avg", metric: "", from: [], by: [], rest: "" };
  const tags = useQuery({
    queryKey: ["metric-tags", p.metric],
    queryFn: () => api<{ tags: string[]; hosts: string[] }>(`/ui/metrics/${encodeURIComponent(p.metric)}/tags`),
    enabled: !!p.metric,
    staleTime: 30_000,
  });
  const tagOptions = useMemo(() => [...(tags.data?.tags ?? []), ...(tags.data?.hosts ?? []).map((h) => `host:${h}`)], [tags.data]);
  const keys = useMemo(() => [...new Set(tagOptions.map((t) => t.split(":")[0]))], [tagOptions]);
  return (
    <div className="flex items-start gap-2">
      <span className="w-6 h-8 rounded flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: color ?? "#6a4bd1" }}>
        {q.name}
      </span>
      {raw ? (
        <Input
          className="flex-1 mono text-xs"
          value={q.query}
          onChange={(e) => onChange({ ...q, query: e.target.value })}
          placeholder="avg:system.cpu.user{*} by {host}"
          data-testid="raw-query"
        />
      ) : (
        <div className="flex flex-1 flex-wrap gap-2 items-start">
          <MetricPicker value={p.metric} onChange={(metric) => onChange({ ...q, query: build({ ...p, metric }) })} />
          <span className="text-xs text-ink-3 pt-2">from</span>
          <TagPicker value={p.from} options={tagOptions} placeholder="(everywhere)" onChange={(from) => onChange({ ...q, query: build({ ...p, from }) })} />
          <Select value={p.agg} onChange={(e) => onChange({ ...q, query: build({ ...p, agg: e.target.value }) })}>
            {AGGS.map((a) => (
              <option key={a} value={a}>
                {a} by
              </option>
            ))}
          </Select>
          <TagPicker value={p.by} options={keys} placeholder="(everything)" onChange={(by) => onChange({ ...q, query: build({ ...p, by }) })} />
        </div>
      )}
      <Button className="px-2" title={raw ? "Use the visual editor" : "Edit the query as text"} onClick={() => setRaw(!raw)}>
        <Code2 size={14} />
      </Button>
      {onRemove && (
        <Button className="px-2" title="Remove query" onClick={onRemove}>
          <Trash2 size={14} />
        </Button>
      )}
    </div>
  );
}

export function QueryList({
  queries,
  formulas,
  onChange,
  showFormulas = true,
}: {
  queries: QDef[];
  formulas: FDef[];
  onChange: (q: QDef[], f: FDef[]) => void;
  showFormulas?: boolean;
}) {
  const next = () => String.fromCharCode(97 + queries.length);
  return (
    <div className="space-y-2">
      {queries.map((q, i) => (
        <MetricQueryRow
          key={i}
          q={q}
          onChange={(nq) =>
            onChange(
              queries.map((x, j) => (j === i ? nq : x)),
              formulas,
            )
          }
          onRemove={
            queries.length > 1
              ? () =>
                  onChange(
                    queries.filter((_, j) => j !== i),
                    formulas,
                  )
              : undefined
          }
        />
      ))}
      {showFormulas &&
        formulas.map((f, i) => (
          <div key={`f${i}`} className="flex items-center gap-2">
            <span className="w-6 h-8 rounded flex items-center justify-center text-[11px] font-bold bg-panel border border-line text-ink-2 shrink-0">ƒ</span>
            <Input
              className="flex-1 mono text-xs"
              value={f.formula}
              onChange={(e) =>
                onChange(
                  queries,
                  formulas.map((x, j) => (j === i ? { ...x, formula: e.target.value } : x)),
                )
              }
              placeholder="a / b * 100"
            />
            <Input
              className="w-40"
              placeholder="alias"
              value={f.alias ?? ""}
              onChange={(e) =>
                onChange(
                  queries,
                  formulas.map((x, j) => (j === i ? { ...x, alias: e.target.value || undefined } : x)),
                )
              }
            />
            <Button
              className="px-2"
              onClick={() =>
                onChange(
                  queries,
                  formulas.filter((_, j) => j !== i),
                )
              }
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      <div className="flex gap-2 pl-8">
        <Button size="sm" onClick={() => onChange([...queries, { name: next(), query: "avg:system.cpu.user{*}", data_source: "metrics" }], formulas)}>
          <Plus size={12} /> Add Query
        </Button>
        {showFormulas && (
          <Button size="sm" onClick={() => onChange(queries, [...formulas, { formula: queries.map((q) => q.name).join(" + ") }])}>
            <Plus size={12} /> Add Formula
          </Button>
        )}
      </div>
    </div>
  );
}
