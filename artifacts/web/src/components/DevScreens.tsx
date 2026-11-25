import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Layers, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthUser } from "@/lib/auth";
import { SECTIONS } from "@/pages/Docs";
import { cn } from "@/components/ui";

type Screen = [label: string, href: string];

export function DevScreens() {
  const [open, setOpen] = useState(false);
  const [loc] = useLocation();
  const search = useSearch();
  const { user } = useAuthUser();
  const enabled = open && !!user;
  const to = Math.floor(Date.now() / 1000);
  const first = useQuery({
    queryKey: ["dev-screens"],
    enabled,
    queryFn: async () => {
      const [dash, mons, svcs, spans] = await Promise.allSettled([
        api<{ dashboards: { id: string }[] }>("/v1/dashboard"),
        api<{ id: number }[]>("/v1/monitor"),
        api<{ services: { service: string }[] }>(`/ui/apm/services?env=*&from=${to - 86400}&to=${to}`),
        api<{ spans: { trace_id: string }[] }>("/ui/apm/spans", { body: { query: "*", from: to - 86400, to, limit: 1 } }),
      ]);
      const ok = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : undefined);
      return {
        dashboard: ok(dash)?.dashboards[0]?.id,
        monitor: ok(mons)?.[0]?.id,
        service: ok(svcs)?.services[0]?.service,
        trace: ok(spans)?.spans[0]?.trace_id,
      };
    },
  });
  const f = first.data;
  const groups: [string, Screen[]][] = [
    [
      "Sign in",
      [
        ["Log in", "/login?screen=login"],
        ["First-time setup", "/login?screen=setup"],
        ["Setup with token", "/login?screen=setup-token"],
        ["Accept invite", "/login?screen=invite"],
        ["Invalid invite", "/login?screen=invite-invalid"],
        ["No access yet", "/login?screen=restricted"],
      ],
    ],
    ["Home", [["Home", "/"]]],
    [
      "Dashboards",
      [
        ["Dashboard list", "/dashboard/lists"],
        ["Dashboard", f?.dashboard ? `/dashboard/${f.dashboard}` : "/dashboard/lists"],
      ],
    ],
    [
      "Infrastructure",
      [
        ["Host list", "/infrastructure"],
        ["Host map", "/infrastructure/map"],
      ],
    ],
    [
      "Metrics",
      [
        ["Explorer", "/metric/explorer"],
        ["Summary", "/metric/summary"],
      ],
    ],
    [
      "Monitors",
      [
        ["Manage monitors", "/monitors/manage"],
        ["New metric monitor", "/monitors/create?type=metric"],
        ["New log monitor", "/monitors/create?type=log"],
        ["New APM monitor", "/monitors/create?type=apm"],
        ["Monitor status", f?.monitor ? `/monitors/${f.monitor}` : "/monitors/manage"],
        ["Edit monitor", f?.monitor ? `/monitors/${f.monitor}/edit` : "/monitors/manage"],
      ],
    ],
    ["Logs", [["Log explorer", "/logs"]]],
    [
      "APM",
      [
        ["Service catalog", "/apm/services"],
        ["Service", f?.service ? `/apm/services/${encodeURIComponent(f.service)}` : "/apm/services"],
        ["Trace explorer", "/apm/traces"],
        ["Trace", f?.trace ? `/apm/trace/${f.trace}` : "/apm/traces"],
      ],
    ],
    ["Events", [["Event explorer", "/event/explorer"]]],
    [
      "Organization settings",
      [
        ["API keys", "/organization-settings?tab=api-keys"],
        ["Application keys", "/organization-settings?tab=app-keys"],
        ["Users", "/organization-settings?tab=users"],
        ["Webhooks & Slack", "/organization-settings?tab=integrations"],
        ["Sample data", "/organization-settings?tab=sample"],
      ],
    ],
    ["Agent", [["Install agent", "/account/agent"]]],
    ["Docs", SECTIONS.map((s): Screen => [s.title, `/docs/${s.id}`])],
    ["Other", [["Page not found", "/dev-screens/not-found"]]],
  ];
  const here = search ? `${loc}?${search}` : loc;
  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-2">
      {open && (
        <div className="w-64 max-h-[70vh] overflow-y-auto rounded-lg border border-line bg-white shadow-2xl py-2 text-[13px]">
          {!user && (
            <p className="mx-2 mb-1 rounded-md bg-brand-100 px-2 py-1.5 text-[12px] text-ink">
              You're logged out, so app screens show the login page. Log in once and they all open.
            </p>
          )}
          {groups.map(([group, screens]) => (
            <div key={group} className="py-1">
              <div className="px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{group}</div>
              {screens.map(([label, href]) => (
                <Link key={label} href={href} className={cn("block px-3 py-1 hover:bg-brand-100", here === href && "bg-brand-100 font-semibold text-primary")}>
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-black text-white text-[12px] font-semibold shadow-lg"
        aria-expanded={open}
        data-testid="dev-screens"
      >
        {open ? <X size={14} /> : <Layers size={14} />} Screens
      </button>
    </div>
  );
}
