import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Search, Plus, Trash2, Copy, Eye, EyeOff, LayoutDashboard, Server, Bell, ScrollText, Activity, LineChart } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { TimePicker } from "@/components/TimePicker";
import { StatusBadge, Empty } from "@/components/Panels";
import { CatMark } from "@/components/Logo";
import { useTime } from "@/lib/time";
import { useAuthUser } from "@/lib/auth";
import { fmtAgo, fmtTime, fmtNum, fmtDuration } from "@/lib/format";
import { Alert, Button, Field, Input, Select, badgeStyles, buttonStyles, cardStyles, labelStyles, sectionTitleStyles, tableStyles } from "@/components/ui";

export function Events() {
  const { from, to, tick } = useTime();
  const [q, setQ] = useState("");
  const ev = useQuery({
    queryKey: ["events", q, from, to, tick],
    queryFn: () => api<{ events: any[] }>(`/ui/events?start=${from}&end=${to}&q=${encodeURIComponent(q)}`),
  });
  const color: Record<string, string> = { error: "#d33b4c", warning: "#e8a317", success: "#2ca05a", info: "#5b7be0" };
  return (
    <div>
      <PageHeader title="Events">
        <TimePicker />
      </PageHeader>
      <div className="p-6">
        <div className="relative mb-3 max-w-xl">
          <Search size={14} className="absolute left-2.5 top-2.5 text-ink-3" />
          <Input className="w-full pl-8" placeholder="Search events" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {(ev.data?.events.length ?? 0) === 0 && !ev.isLoading ? (
          <Empty title="No events in this time range">Monitor state changes, agent events and events sent to the API appear here.</Empty>
        ) : (
          <div className={cardStyles({ className: "divide-y divide-line" })}>
            {ev.data?.events.map((e) => (
              <div key={e.id} className="flex gap-3 px-4 py-2.5">
                <span className="w-1 rounded shrink-0" style={{ background: color[e.alert_type] ?? "#5b7be0" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{e.title}</span>
                    {e.monitor_id && (
                      <Link className="text-xs text-primary" href={`/monitors/${e.monitor_id}`}>
                        monitor →
                      </Link>
                    )}
                    <span className="ml-auto text-xs text-ink-3 whitespace-nowrap">{fmtTime(e.ts, true)}</span>
                  </div>
                  {e.text && <div className="text-xs text-ink-2 whitespace-pre-wrap mt-0.5 line-clamp-3">{e.text}</div>}
                  <div className="flex gap-1 mt-1">
                    <span className={badgeStyles()}>source:{e.source}</span>
                    {e.tags.slice(0, 6).map((t: string) => (
                      <span key={t} className={badgeStyles()}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KeyCell({ k }: { k: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="inline-flex items-center gap-2 mono text-xs">
      {show ? k : `${k.slice(0, 4)}••••••••••••${k.slice(-4)}`}
      <button onClick={() => setShow(!show)} className="text-ink-3">
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <button onClick={() => navigator.clipboard.writeText(k)} className="text-ink-3" title="Copy">
        <Copy size={13} />
      </button>
    </span>
  );
}

export function OrgSettings() {
  const qc = useQueryClient();
  const params = new URLSearchParams(useSearch());
  const [tab, setTab] = useState(params.get("tab") ?? "api-keys");
  const org = useQuery({ queryKey: ["org"], queryFn: () => api<any>("/ui/org") });
  const channels = useQuery({ queryKey: ["channels"], queryFn: () => api<{ channels: any[] }>("/ui/channels") });
  const inv = (fn: (v: any) => Promise<any>) => ({
    mutationFn: fn as (v: any) => Promise<any>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org"] });
      qc.invalidateQueries({ queryKey: ["channels"] });
    },
  });
  const [keyName, setKeyName] = useState("");
  const [created, setCreated] = useState<{ kind: string; key: string } | null>(null);
  const addKey = useMutation(
    inv((kind: string) =>
      api("/ui/org/keys", { body: { kind, name: keyName.trim() || (kind === "app" ? "Application key" : "API key") } }).then((r) => {
        setKeyName("");
        setCreated({ kind: r.kind, key: r.key });
        return r;
      }),
    ),
  );
  const delKey = useMutation(inv((id: number) => api(`/ui/org/keys/${id}`, { method: "DELETE" })));
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const invite = useMutation({
    ...inv((e: string) => api("/ui/org/invites", { body: { email: e } })),
    onError: (e: any) => setErr(e.message),
    onSettled: () => setEmail(""),
  });
  const delInvite = useMutation(inv((id: number) => api(`/ui/org/invites/${id}`, { method: "DELETE" })));
  const [ch, setCh] = useState({ kind: "webhook", name: "", url: "" });
  const addCh = useMutation({
    ...inv(() => api("/ui/channels", { body: ch })),
    onError: (e: any) => setErr(e.message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      setErr(null);
      setCh({ kind: "webhook", name: "", url: "" });
    },
  });
  const delCh = useMutation(inv((id: number) => api(`/ui/channels/${id}`, { method: "DELETE" })));
  const isAdmin = org.data?.me?.role === "admin";
  const tabs = [
    ["api-keys", "API Keys"],
    ["app-keys", "Application Keys"],
    ["users", "Users"],
    ["integrations", "Webhooks & Slack"],
    ["sample", "Sample Data"],
  ];
  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Organization Settings" />
      <div className="flex flex-1 min-h-0">
        <aside className="w-56 border-r border-line bg-panel py-3">
          {tabs.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`block w-full text-left px-4 py-1.5 text-[13px] ${tab === k ? "bg-brand-100 text-primary font-semibold" : "hover:bg-brand-100"}`}
            >
              {l}
            </button>
          ))}
        </aside>
        <div className="flex-1 overflow-auto p-6">
          {err && (
            <div className={cardStyles({ className: "bg-red-50 border-alert/30 text-alert p-2 text-xs mb-3" })} onClick={() => setErr(null)}>
              {err}
            </div>
          )}
          {(tab === "api-keys" || tab === "app-keys") &&
            (() => {
              const kind = tab === "api-keys" ? "api" : "app";
              const keys = (org.data?.keys ?? []).filter((k: any) => k.kind === kind);
              return (
                <div>
                  <div className="flex items-center mb-3">
                    <p className="text-ink-2 max-w-2xl">
                      {kind === "api"
                        ? "API keys identify your organization when the agent, tracers and the HTTP intake send data to DataCat."
                        : "Application keys, used together with an API key, give scripts access to the DataCat API (dashboards, monitors, queries)."}
                    </p>
                    {isAdmin && (
                      <>
                        <Input
                          className="ml-auto w-56"
                          placeholder="Key name (optional)"
                          aria-label="New key name"
                          value={keyName}
                          onChange={(e) => setKeyName(e.target.value)}
                          maxLength={100}
                        />
                        <Button variant="primary" className="ml-2" onClick={() => addKey.mutate(kind)} data-testid={`new-${kind}-key`}>
                          <Plus size={14} /> New Key
                        </Button>
                      </>
                    )}
                  </div>
                  {!isAdmin && <p className="text-xs text-ink-3 mb-3">Only admins can create, view or revoke keys.</p>}
                  {created?.kind === kind && (
                    <div className={cardStyles({ className: "bg-panel p-3 mb-3 text-xs" })} data-testid="new-key-banner">
                      <div className="font-semibold mb-1">
                        {kind === "app" ? "Copy your new application key now. It will not be shown again." : "New API key created."}
                      </div>
                      <KeyCell k={created.key} />
                    </div>
                  )}
                  <table className={tableStyles({ className: "bg-white border border-line rounded-lg" })}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Key</th>
                        <th>Created</th>
                        <th>Last used</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((k: any) => (
                        <tr key={k.id}>
                          <td>{k.name}</td>
                          <td>{k.key ? <KeyCell k={k.key} /> : <span className="mono text-xs text-ink-3">{k.hint}</span>}</td>
                          <td className="text-ink-2">{fmtAgo(new Date(k.created_at).getTime())}</td>
                          <td className="text-ink-2">{k.last_used_at ? fmtAgo(new Date(k.last_used_at).getTime()) : "never"}</td>
                          <td className="text-right">
                            {isAdmin && (
                              <button
                                className="text-ink-3 hover:text-alert"
                                aria-label="Revoke key"
                                onClick={() => confirm("Revoke this key? Anything using it will stop working.") && delKey.mutate(k.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          {tab === "users" && (
            <div className="space-y-6">
              {isAdmin && (
                <div className={cardStyles({ className: "p-4" })}>
                  <div className={sectionTitleStyles({ className: "mb-1" })}>Invite a tester</div>
                  <p className="text-xs text-ink-2 mb-2">
                    Share an invite link so a new member can create their password and join this organization. Links expire after 30 days and can only be used
                    once.
                  </p>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      invite.mutate(email);
                    }}
                  >
                    <Input
                      className="w-80"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="invite-email"
                    />
                    <Button variant="primary" disabled={!email}>
                      Send invite
                    </Button>
                  </form>
                </div>
              )}
              <div>
                <div className={sectionTitleStyles({ className: "mb-2" })}>Users ({org.data?.members?.length ?? 0})</div>
                <table className={tableStyles({ className: "bg-white border border-line rounded-lg" })}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(org.data?.members ?? []).map((m: any) => (
                      <tr key={m.id}>
                        <td>{m.name || "—"}</td>
                        <td>{m.email}</td>
                        <td className="capitalize">{m.role}</td>
                        <td className="text-ink-2">{fmtAgo(new Date(m.created_at).getTime())}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(org.data?.invites ?? []).length > 0 && (
                <div>
                  <div className={sectionTitleStyles({ className: "mb-2" })}>Pending invites</div>
                  <table className={tableStyles({ className: "bg-white border border-line rounded-lg" })}>
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Invite link</th>
                        <th>Sent</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {org.data.invites.map((i: any) => (
                        <tr key={i.id}>
                          <td>{i.email}</td>
                          <td>
                            {i.link && (
                              <button
                                className="text-primary text-xs inline-flex items-center gap-1"
                                onClick={() => navigator.clipboard.writeText(new URL(i.link, location.origin).href)}
                              >
                                <Copy size={12} /> Copy link
                              </button>
                            )}
                          </td>
                          <td className="text-ink-2">{fmtAgo(new Date(i.created_at).getTime())}</td>
                          <td className="text-right">
                            {isAdmin && (
                              <button className="text-ink-3 hover:text-alert" onClick={() => delInvite.mutate(i.id)}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {tab === "sample" && (
            <div className={cardStyles({ className: "p-5 max-w-2xl space-y-3" })}>
              <div className={sectionTitleStyles()}>Sample data</div>
              <p className="text-ink-2">
                Simulates four hosts and three services (storefront, checkout-api, payments) sending metrics, logs and traces through the same intake the agent
                uses, for two hours, with 30 minutes of history. Useful for exploring DataCat before installing an agent. Sample data is tagged{" "}
                <span className="mono">env:sample</span>.
              </p>
              <SampleDataButton />
            </div>
          )}
          {tab === "integrations" && (
            <div className="space-y-4">
              <p className="text-ink-2 max-w-2xl">
                Monitors notify a channel when you mention it in the monitor message, e.g. <span className="mono">@webhook-oncall</span> or{" "}
                <span className="mono">@slack-alerts</span>. Slack channels take a Slack incoming-webhook URL.
              </p>
              {!isAdmin && <p className="text-xs text-ink-3">Only admins can add or remove channels.</p>}
              <form
                hidden={!isAdmin}
                className={cardStyles({ className: "p-4 flex flex-wrap gap-2 items-end" })}
                onSubmit={(e) => {
                  e.preventDefault();
                  addCh.mutate(undefined);
                }}
              >
                <label className="text-xs">
                  <div className={labelStyles({ className: "mb-1" })}>Type</div>
                  <Select value={ch.kind} onChange={(e) => setCh({ ...ch, kind: e.target.value })}>
                    <option value="webhook">Webhook</option>
                    <option value="slack">Slack</option>
                  </Select>
                </label>
                <label className="text-xs">
                  <div className={labelStyles({ className: "mb-1" })}>Name</div>
                  <Input
                    className="w-48"
                    value={ch.name}
                    onChange={(e) => setCh({ ...ch, name: e.target.value })}
                    placeholder="oncall"
                    data-testid="channel-name"
                  />
                </label>
                <label className="text-xs flex-1">
                  <div className={labelStyles({ className: "mb-1" })}>URL</div>
                  <Input
                    className="w-full"
                    value={ch.url}
                    onChange={(e) => setCh({ ...ch, url: e.target.value })}
                    placeholder="https://hooks.example.com/..."
                    data-testid="channel-url"
                  />
                </label>
                <Button variant="primary" disabled={!ch.name || !ch.url}>
                  Add channel
                </Button>
              </form>
              <table className={tableStyles({ className: "bg-white border border-line rounded-lg" })}>
                <thead>
                  <tr>
                    <th>Handle</th>
                    <th>Type</th>
                    <th>URL</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(channels.data?.channels ?? []).map((c) => (
                    <tr key={c.id}>
                      <td className="mono text-xs">
                        @{c.kind}-{c.name}
                      </td>
                      <td className="capitalize">{c.kind}</td>
                      <td className="mono text-xs truncate max-w-[420px]">{c.config.url}</td>
                      <td className="text-right">
                        {isAdmin && (
                          <button className="text-ink-3 hover:text-alert" aria-label="Delete channel" onClick={() => delCh.mutate(c.id)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AgentSetup() {
  const org = useQuery({ queryKey: ["org"], queryFn: () => api<any>("/ui/org") });
  const key = (org.data?.keys ?? []).find((k: any) => k.kind === "api")?.key ?? "<YOUR_API_KEY>";
  const url = org.data?.public_url ?? location.origin;
  const [tab, setTab] = useState("linux");
  const yaml = `api_key: ${key}
url: ${url}
env: prod
host_metrics:
  enabled: true
apm:
  otlp: true
  datadog_compat: true
dogstatsd:
  enabled: true
logs:
  - path: /var/log/myapp/*.log
    service: myapp`;
  const docker = `docker run -d --name datacat-agent --network host \
  -v /proc:/hostfs/proc:ro -v /var/log:/var/log:ro \
  -v /etc/datacat:/etc/datacat \
  -e DATACAT_API_KEY=${key} \
  debian:stable-slim sh -c "apt-get update -qq && apt-get install -yqq curl >/dev/null && curl -fsSL ${url}/install.sh | sh && /opt/datacat-agent/bin/datacat-agent run -c /etc/datacat/datacat.yaml"`;
  const code = (s: string) => (
    <div className="relative">
      <pre className="mono text-xs bg-brand-900 text-white rounded p-4 overflow-auto">{s}</pre>
      <button className="absolute top-2 right-2 text-white/60 hover:text-white" onClick={() => navigator.clipboard.writeText(s)}>
        <Copy size={14} />
      </button>
    </div>
  );
  return (
    <div>
      <PageHeader title="Install the DataCat Agent" />
      <div className="p-6 max-w-4xl space-y-5">
        <p className="text-ink-2">
          The DataCat Agent is built on the OpenTelemetry Collector. It reports host metrics, tails log files, relays traces, metrics and logs from your apps,
          and accepts compatible tracer and StatsD traffic for easy migration. See the{" "}
          <a className="text-primary" href="/docs/agent">
            agent guide
          </a>{" "}
          and the{" "}
          <a className="text-primary" href="/docs/nodejs">
            Node.js
          </a>{" "}
          /{" "}
          <a className="text-primary" href="/docs/python">
            Python
          </a>{" "}
          libraries.
        </p>
        <div className="flex gap-1">
          {[
            ["linux", "Linux (one line)"],
            ["config", "Config file"],
            ["docker", "Docker"],
            ["libs", "Libraries"],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3 h-8 rounded text-[13px] ${tab === k ? "bg-primary text-white" : "bg-panel hover:bg-brand-100"}`}
            >
              {l}
            </button>
          ))}
        </div>
        {tab === "linux" && (
          <>
            {code(`curl -fsSL ${url}/install.sh | DATACAT_API_KEY=${key} sh`)}
            <p className="text-xs text-ink-2">
              Installs <span className="mono">/opt/datacat-agent/bin/datacat-agent</span>, writes <span className="mono">/etc/datacat/datacat.yaml</span> and
              starts the service on systemd hosts. Your host appears in Infrastructure within a minute.
            </p>
          </>
        )}
        {tab === "config" && (
          <>
            {code(yaml)}
            <p className="text-xs text-ink-2">
              Edit <span className="mono">/etc/datacat/datacat.yaml</span> and restart the agent.{" "}
              <span className="mono">datacat-agent config -c /etc/datacat/datacat.yaml</span> prints the generated OpenTelemetry Collector configuration.
            </p>
          </>
        )}
        {tab === "docker" && code(docker)}
        {tab === "libs" &&
          code(`# Node.js
npm install ${url}/downloads/datacat-trace-0.1.0.tgz
DATACAT_SERVICE=my-app DATACAT_ENV=prod node -r @datacat/trace/init app.js

# Python
pip install "datacat-trace[instrumentation] @ ${url}/downloads/datacat_trace-0.1.0-py3-none-any.whl"
DATACAT_SERVICE=my-app DATACAT_ENV=prod datacat-run python app.py`)}
      </div>
    </div>
  );
}

export function SampleDataButton() {
  const qc = useQueryClient();
  const st = useQuery({ queryKey: ["sample"], queryFn: () => api<{ running: boolean }>("/ui/org/sample-data") });
  const m = useMutation({
    mutationFn: (stop: boolean) => api<{ running: boolean }>("/ui/org/sample-data", { body: stop ? { stop: true } : { minutes: 120 } }),
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
  const running = st.data?.running;
  return (
    <Button disabled={m.isPending} onClick={() => m.mutate(!!running)} data-testid="sample-data">
      {m.isPending ? "Loading sample data…" : running ? "Stop sample data" : "Load sample data"}
    </Button>
  );
}

export function Home() {
  const { user } = useAuthUser();
  const hosts = useQuery({ queryKey: ["hosts"], queryFn: () => api<{ hosts: any[] }>("/ui/hosts") });
  const mons = useQuery({ queryKey: ["monitors"], queryFn: () => api<any[]>("/v1/monitor") });
  const dash = useQuery({ queryKey: ["dashboards"], queryFn: () => api<{ dashboards: any[] }>("/v1/dashboard") });
  const now = Math.floor(Date.now() / 1000);
  const svcs = useQuery({ queryKey: ["home-svcs"], queryFn: () => api<{ services: any[] }>(`/ui/apm/services?from=${now - 3600}&to=${now}`) });
  const logs = useQuery({
    queryKey: ["home-logs"],
    queryFn: () => api<{ total: number }>("/ui/logs/search", { body: { query: "*", from: now - 3600, to: now, limit: 1 } }),
  });
  const alerting = (mons.data ?? []).filter((m) => m.overall_state === "Alert" || m.overall_state === "Warn");
  const tiles = [
    { label: "Active hosts", value: hosts.data?.hosts.filter((h) => h.up).length, href: "/infrastructure", icon: Server },
    { label: "Services", value: svcs.data?.services.length, href: "/apm/services", icon: Activity },
    { label: "Logs (past hour)", value: logs.data?.total, href: "/logs", icon: ScrollText },
    { label: "Monitors alerting", value: alerting.length, href: "/monitors/manage?status=Alert", icon: Bell },
    { label: "Dashboards", value: dash.data?.dashboards.length, href: "/dashboard/lists", icon: LayoutDashboard },
  ];
  const empty = hosts.data && hosts.data.hosts.length === 0 && (svcs.data?.services.length ?? 0) === 0;
  return (
    <div>
      <PageHeader title={`Welcome${user?.firstName ? ", " + user.firstName : ""}`} sub={user?.orgName} />
      <div className="p-8 space-y-8 max-w-[1400px]">
        {empty && (
          <div className={cardStyles({ className: "p-6 flex items-center gap-5 bg-brand-100 border-brand-100" })}>
            <CatMark size={64} />
            <div className="flex-1">
              <div className={sectionTitleStyles()}>Start sending data to DataCat</div>
              <div className="text-ink-2">Add DataCat to your code (Node.js or Python) or install the host agent. It takes about ten minutes.</div>
            </div>
            <SampleDataButton />
            <Link href="/docs/getting-started" className={buttonStyles({ variant: "primary" })}>
              Get started
            </Link>
          </div>
        )}
        <div className="grid grid-cols-5 gap-4">
          {tiles.map((t) => (
            <Link key={t.label} href={t.href} className={cardStyles({ className: "p-5 rounded-xl hover:border-brand-400 hover:shadow-sm transition" })}>
              <div className="flex items-center gap-2 text-ink-2 text-[13px]">
                <t.icon size={16} />
                {t.label}
              </div>
              <div className="text-[32px] font-semibold tracking-tight mt-2">{t.value === undefined ? "—" : fmtNum(t.value)}</div>
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className={cardStyles({ className: "rounded-xl overflow-hidden" })}>
            <div className="px-5 py-3.5 border-b border-line text-[15px] font-semibold flex items-center">
              Triggered monitors
              <Link href="/monitors/manage" className="ml-auto text-[13px] text-primary font-medium">
                All monitors →
              </Link>
            </div>
            {alerting.length === 0 ? (
              <div className="px-5 py-8 text-ink-3 text-[13px] text-center">All monitors are OK.</div>
            ) : (
              alerting.map((m) => (
                <Link
                  key={m.id}
                  href={`/monitors/${m.id}`}
                  className="flex items-center gap-2 px-5 py-3 border-b border-line last:border-0 hover:bg-brand-100 text-[13px]"
                >
                  <StatusBadge state={m.overall_state} />
                  <span className="truncate">{m.name}</span>
                </Link>
              ))
            )}
          </div>
          <div className={cardStyles({ className: "rounded-xl overflow-hidden" })}>
            <div className="px-5 py-3.5 border-b border-line text-[15px] font-semibold flex items-center">
              Services
              <Link href="/apm/services" className="ml-auto text-[13px] text-primary font-medium">
                Service Catalog →
              </Link>
            </div>
            {(svcs.data?.services ?? []).slice(0, 8).map((s) => (
              <Link
                key={s.service}
                href={`/apm/services/${encodeURIComponent(s.service)}`}
                className="flex items-center gap-3 px-5 py-3 border-b border-line last:border-0 hover:bg-brand-100 text-[13px]"
              >
                <span className="flex-1 font-medium text-primary">{s.service}</span>
                <span className="text-ink-2">p95 {fmtDuration(s.p95)}</span>
                <span className={s.error_rate > 0.05 ? "text-alert" : "text-ink-2"}>{(s.error_rate * 100).toFixed(1)}% err</span>
              </Link>
            ))}
            {!svcs.data?.services.length && <div className="px-5 py-8 text-ink-3 text-[13px] text-center">No services reporting in the past hour.</div>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/metric/explorer" className={buttonStyles()}>
            <LineChart size={14} />
            Explore metrics
          </Link>
          <Link href="/monitors/create" className={buttonStyles()}>
            <Bell size={14} />
            New monitor
          </Link>
          <Link href="/dashboard/lists?new=1" className={buttonStyles()}>
            <LayoutDashboard size={14} />
            New dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

const FIELD_IDS = { setupToken: "setup-token", orgName: "org-name", email: "login-email", password: "login-password" };

export function Login({ restricted, email }: { restricted?: boolean; email?: string | null }) {
  const { logout, data } = useAuthUser();
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const token = window.location.pathname.startsWith("/invite/") ? window.location.pathname.split("/")[2] : "";
  const invite = useQuery({
    queryKey: ["invite", token],
    enabled: !!token,
    queryFn: () => api<{ email: string; role: string }>(`/auth/invites/${encodeURIComponent(token)}`),
    retry: false,
  });
  const inviteData = invite.data;
  const inviteError = invite.error?.message;
  const setup = !!data?.setupRequired && !token;
  const setupTokenRequired = !!data?.setupTokenRequired;
  const isRestricted = restricted;
  const [submitted, setSubmitted] = useState(false);
  const emailValue = (inviteData?.email ?? address).trim();
  const validate = () => {
    const errors: Partial<Record<keyof typeof FIELD_IDS, string>> = {};
    if (setup && setupTokenRequired && !setupToken.trim()) errors.setupToken = "Enter the setup token.";
    if (setup && !orgName.trim()) errors.orgName = "Enter an organization name.";
    if (!emailValue) errors.email = "Enter your email.";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailValue)) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Enter your password.";
    else if (password.length < 12) errors.password = "Use at least 12 characters.";
    return errors;
  };
  const errors = submitted ? validate() : {};
  const invalid = (id: string, error?: string) => ({ id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-error` : undefined });
  const inputCls = "w-full h-9 px-3 text-[14px] font-normal";
  const submit = useMutation({
    mutationFn: () =>
      api(token ? `/auth/invites/${encodeURIComponent(token)}` : setup ? "/auth/setup" : "/auth/login", {
        body: { email: inviteData?.email ?? address, password, orgName, ...(setup && setupTokenRequired ? { setupToken } : {}) },
      }),
    onSuccess: () => {
      const path = window.location.pathname;
      window.location.href = token || path === "/login" ? "/" : path + window.location.search;
    },
  });
  return (
    <div className="min-h-full flex items-center justify-center bg-brand-900 py-8">
      <div className="bg-white rounded-xl shadow-2xl px-8 py-8 w-[380px] min-h-0 flex flex-col text-center">
        <div className="flex-1 flex flex-col justify-center">
          <div className="flex justify-center">
            <div className="relative w-[120px] h-[120px] flex items-end justify-center">
              <div className="absolute left-[2px] right-0 bottom-[2px] top-[22px] rounded-[5px] bg-nav -rotate-[8deg]" />
              <img src={`${import.meta.env.BASE_URL}logo-cat.svg`} width={90} height={98} alt="DataCat" className="relative" />
            </div>
          </div>
          <h1 className="mt-3 text-[22px] leading-tight font-bold tracking-tight">DataCat</h1>
          <p className="mt-1 text-[13px] text-ink-2">Metrics, logs, traces and alerts in one place.</p>
          {setup && <h2 className="mt-5 text-left font-semibold text-[20px] tracking-tight">Set up DataCat</h2>}
          {!token && !isRestricted && window.location.pathname !== "/login" && window.location.pathname !== "/" && (
            <div className="mt-5">
              <Alert tone="info">Log in to open this page. You'll go straight to it after signing in.</Alert>
            </div>
          )}
          {inviteError && (
            <div className="mt-5">
              <Alert>{inviteError}</Alert>
            </div>
          )}
          {isRestricted ? (
            <>
              <div className="mt-5">
                <Alert tone="info">
                  <b>{email}</b> doesn't have access yet. Ask an admin to invite you, then open the invite link.
                </Alert>
              </div>
              <Button variant="dark" className="mt-4 w-full" onClick={logout}>
                Sign in with a different account
              </Button>
            </>
          ) : (
            <>
              {(!token || inviteData) && (
                <form
                  className="mt-5 text-left flex flex-col gap-3.5"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSubmitted(true);
                    const first = Object.keys(validate())[0];
                    if (first) {
                      document.getElementById(FIELD_IDS[first as keyof typeof FIELD_IDS])?.focus();
                      return;
                    }
                    submit.mutate();
                  }}
                >
                  {setup && setupTokenRequired && (
                    <Field id="setup-token" label="Setup token" error={errors.setupToken}>
                      <Input
                        {...invalid("setup-token", errors.setupToken)}
                        className={`${inputCls} mono placeholder:font-sans`}
                        value={setupToken}
                        onChange={(e) => {
                          setSetupToken(e.target.value);
                          submit.reset();
                        }}
                        autoComplete="off"
                        placeholder="From the server log or DATACAT_SETUP_TOKEN"
                        data-testid="setup-token"
                      />
                    </Field>
                  )}
                  {setup && (
                    <Field id="org-name" label="Organization name" error={errors.orgName}>
                      <Input
                        {...invalid("org-name", errors.orgName)}
                        className={inputCls}
                        maxLength={150}
                        value={orgName}
                        onChange={(e) => {
                          setOrgName(e.target.value);
                          submit.reset();
                        }}
                        autoComplete="organization"
                      />
                    </Field>
                  )}
                  <Field id="login-email" label="Email" error={errors.email}>
                    <Input
                      {...invalid("login-email", errors.email)}
                      className={inputCls}
                      type="email"
                      value={inviteData?.email ?? address}
                      readOnly={!!token}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        submit.reset();
                      }}
                      autoComplete="username"
                      data-testid="login-email"
                    />
                  </Field>
                  <Field
                    id="login-password"
                    label="Password"
                    error={errors.password}
                    description={(setup || token) && password.length > 0 && password.length < 12 ? "Use at least 12 characters." : undefined}
                  >
                    <Input
                      {...invalid("login-password", errors.password)}
                      className={inputCls}
                      type="password"
                      maxLength={256}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        submit.reset();
                      }}
                      autoComplete={setup || token ? "new-password" : "current-password"}
                      data-testid="login-password"
                    />
                  </Field>
                  {submit.isError && Object.keys(errors).length === 0 && <Alert>{submit.error.message}</Alert>}
                  <Button variant="dark" className="mt-0.5 w-full" disabled={submit.isPending} data-testid="login">
                    {submit.isPending ? "Please wait…" : setup ? "Create admin account" : token ? "Create account" : "Log in"}
                  </Button>
                </form>
              )}
            </>
          )}
          <p className="mt-4 text-[12px] text-ink-3">
            {token ? (
              <a href="/login" className="text-primary">
                Already have an account? Log in
              </a>
            ) : (
              "Need access? Ask your admin for an invite."
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
