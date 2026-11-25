import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";

export function SidePanel({
  open,
  onClose,
  title,
  children,
  width = 640,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/10" onClick={onClose}>
      <div className="h-full bg-white shadow-2xl border-l border-line flex flex-col" style={{ width }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-5 h-12 border-b border-line">
          <div className="font-semibold truncate flex-1">{title}</div>
          <button onClick={onClose} className="text-ink-3 hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto scroll-thin">{children}</div>
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 960,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  width?: number;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[4vh]" onClick={onClose}>
      <div className="bg-white rounded shadow-2xl flex flex-col max-h-[92vh]" style={{ width }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-5 h-12 border-b border-line">
          <div className="font-semibold flex-1">{title}</div>
          <button onClick={onClose} className="text-ink-3 hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto scroll-thin">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line bg-panel">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 text-ink-2">
      <div className="text-[15px] font-semibold text-ink mb-1">{title}</div>
      <div className="max-w-md text-[13px]">{children}</div>
    </div>
  );
}

export function StatusBadge({ state }: { state: string }) {
  const map: Record<string, string> = { OK: "bg-ok", Alert: "bg-alert", Warn: "bg-warn", "No Data": "bg-nodata", Muted: "bg-ink-3" };
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[48px] px-2 h-[20px] rounded-[3px] text-[11px] font-bold text-white uppercase tracking-wide ${map[state] ?? "bg-nodata"}`}
    >
      {state}
    </span>
  );
}

export function Facet({
  title,
  values,
  selected,
  onToggle,
}: {
  title: string;
  values: { value: string; count: number }[];
  selected?: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="border-b border-line py-2">
      <div className="px-3 pb-1 text-[13px] font-semibold text-ink">{title}</div>
      {values.length === 0 && <div className="px-3 text-[11px] text-ink-3">No values</div>}
      {values.map((v) => (
        <label key={v.value} className="flex items-center gap-2 px-3 py-[3px] text-[12px] hover:bg-brand-50 cursor-pointer">
          <input type="checkbox" checked={selected?.includes(v.value) ?? false} onChange={() => onToggle(v.value)} className="accent-primary" />
          <span className="flex-1 truncate" title={v.value}>
            {v.value}
          </span>
          <span className="text-ink-3">{v.count}</span>
        </label>
      ))}
    </div>
  );
}
