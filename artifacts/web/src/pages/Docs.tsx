import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Copy, Check, BookOpen } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { cardStyles, tableStyles } from "@/components/ui";

export const SECTIONS: { id: string; title: string; group: string }[] = [
  { id: "getting-started", title: "Getting started", group: "Start here" },
  { id: "agent", title: "DataCat Agent (servers & VMs)", group: "Add DataCat to your code" },
  { id: "nodejs", title: "Node.js", group: "Add DataCat to your code" },
  { id: "python", title: "Python", group: "Add DataCat to your code" },
  { id: "migrate", title: "Migrating from Datadog", group: "Add DataCat to your code" },
  { id: "monitors", title: "Alert on your app", group: "Guides" },
  { id: "dashboards", title: "Build a dashboard", group: "Guides" },
  { id: "query-syntax", title: "Query & search syntax", group: "Reference" },
  { id: "http-api", title: "HTTP API", group: "Reference" },
];

function Code({ children, lang }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group my-3">
      {lang && <div className="absolute left-3 top-1.5 text-[10px] uppercase tracking-wide text-white/40">{lang}</div>}
      <pre className="mono text-[12px] leading-relaxed bg-brand-900 text-white rounded p-4 pt-6 overflow-auto whitespace-pre">{children}</pre>
      <button
        className="absolute top-2 right-2 text-white/50 hover:text-white"
        onClick={() => {
          navigator.clipboard.writeText(children);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        aria-label="Copy code"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}
const H2 = ({ children }: { children: ReactNode }) => <h2 className="text-[20px] font-semibold mt-2 mb-3">{children}</h2>;
const H3 = ({ children }: { children: ReactNode }) => <h3 className="text-[15px] font-semibold mt-6 mb-2">{children}</h3>;
const P = ({ children }: { children: ReactNode }) => <p className="text-[13.5px] leading-relaxed text-ink-2 my-2 max-w-3xl">{children}</p>;
const C = ({ children }: { children: ReactNode }) => (
  <code className="mono text-[12px] bg-panel border border-line rounded px-1 py-0.5 text-ink">{children}</code>
);
const Steps = ({ children }: { children: ReactNode }) => <ol className="list-decimal pl-5 space-y-1.5 text-[13.5px] text-ink-2 my-2 max-w-3xl">{children}</ol>;
const Note = ({ children }: { children: ReactNode }) => (
  <div className={cardStyles({ className: "bg-brand-100 border-brand-100 p-3 text-[13px] text-ink-2 my-3 max-w-3xl" })}>{children}</div>
);

export function Docs() {
  const params = useParams<{ section?: string }>();
  const section = params.section ?? "getting-started";
  const org = useQuery({ queryKey: ["org"], queryFn: () => api<any>("/ui/org") });
  const KEY = (org.data?.keys ?? []).find((k: any) => k.kind === "api")?.key ?? "<YOUR_API_KEY>";
  const URL = org.data?.public_url ?? location.origin;
  const HOST = new globalThis.URL(URL).host;
  const groups = [...new Set(SECTIONS.map((s) => s.group))];
  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <BookOpen size={18} className="text-primary" />
            Documentation
          </span>
        }
        sub="Code snippets below already include your organization's API key and this DataCat URL"
      />
      <div className="flex flex-1 min-h-0">
        <aside className="w-60 border-r border-line bg-panel overflow-auto py-4">
          {groups.map((g) => (
            <div key={g} className="mb-4">
              <div className="px-4 label mb-1">{g}</div>
              {SECTIONS.filter((s) => s.group === g).map((s) => (
                <Link
                  key={s.id}
                  href={`/docs/${s.id}`}
                  className={`block px-4 py-1.5 text-[13px] ${section === s.id ? "bg-brand-100 text-primary font-semibold" : "hover:bg-brand-100"}`}
                >
                  {s.title}
                </Link>
              ))}
            </div>
          ))}
        </aside>
        <article className="flex-1 overflow-auto px-10 py-8" data-testid="docs-article">
          {section === "getting-started" && (
            <>
              <H2>Getting started with DataCat</H2>
              <P>
                DataCat collects <b>traces</b>, <b>logs</b> and <b>metrics</b> from your applications and hosts, lets you explore them, and alerts you when
                something goes wrong. You instrument with DataCat's own open-source stack, built on <b>OpenTelemetry</b>: the{" "}
                <Link className="text-primary" href="/docs/agent">
                  DataCat Agent
                </Link>{" "}
                for hosts and the{" "}
                <Link className="text-primary" href="/docs/nodejs">
                  Node.js
                </Link>{" "}
                and{" "}
                <Link className="text-primary" href="/docs/python">
                  Python
                </Link>{" "}
                libraries for code. Existing agents and tracers can also work. See the{" "}
                <Link className="text-primary" href="/docs/migrate">
                  migration guide
                </Link>
                .
              </P>
              <H3>The happy path (about 10 minutes)</H3>
              <Steps>
                <li>
                  <b>Get your API key.</b> It identifies your organization. Find it under{" "}
                  <Link className="text-primary" href="/organization-settings">
                    Organization Settings → API Keys
                  </Link>
                  . Every snippet in these docs already contains it:{" "}
                  <C>
                    {KEY.slice(0, 4)}…{KEY.slice(-4)}
                  </C>
                  .
                </li>
                <li>
                  <b>Install the agent on your server</b> (optional): one command installs the{" "}
                  <Link className="text-primary" href="/docs/agent">
                    DataCat Agent
                  </Link>
                  , which reports CPU, memory, disk and network, tails your log files and relays telemetry from your apps.
                </li>
                <li>
                  <b>Add DataCat to your code.</b> One line for{" "}
                  <Link className="text-primary" href="/docs/nodejs">
                    Node.js
                  </Link>{" "}
                  or one command for{" "}
                  <Link className="text-primary" href="/docs/python">
                    Python
                  </Link>
                  . With an agent on the machine nothing else is needed; without one (serverless or containers) the library sends straight to DataCat.
                </li>
                <li>
                  <b>See your data.</b> Requests appear in{" "}
                  <Link className="text-primary" href="/apm/services">
                    APM
                  </Link>{" "}
                  within seconds, logs in the{" "}
                  <Link className="text-primary" href="/logs">
                    Log Explorer
                  </Link>{" "}
                  (linked to their traces), host metrics in{" "}
                  <Link className="text-primary" href="/infrastructure">
                    Infrastructure
                  </Link>{" "}
                  and custom metrics in the{" "}
                  <Link className="text-primary" href="/metric/explorer">
                    Metrics Explorer
                  </Link>
                  .
                </li>
                <li>
                  <b>Get alerted.</b>{" "}
                  <Link className="text-primary" href="/docs/monitors">
                    Create a monitor
                  </Link>{" "}
                  on error logs, failing requests or any metric, and send notifications to a webhook or Slack.
                </li>
                <li>
                  <b>Share a view.</b>{" "}
                  <Link className="text-primary" href="/docs/dashboards">
                    Build a dashboard
                  </Link>{" "}
                  for your team.
                </li>
              </Steps>
              <H3>Your connection details</H3>
              <div className="grid grid-cols-[200px_1fr] gap-y-1 text-[13px] max-w-3xl">
                <span className="text-ink-3">DataCat URL</span>
                <span className="mono">{URL}</span>
                <span className="text-ink-3">API key</span>
                <span className="mono">{KEY}</span>
                <span className="text-ink-3">OTLP/HTTP endpoint</span>
                <span className="mono">{URL}/otlp (header DC-API-KEY)</span>
                <span className="text-ink-3">Agent installer</span>
                <span className="mono">{URL}/install.sh</span>
                <span className="text-ink-3">Downloads</span>
                <span className="mono">{URL}/downloads</span>
              </div>
            </>
          )}

          {section === "agent" && (
            <>
              <H2>DataCat Agent</H2>
              <P>
                The DataCat Agent is a single binary built on the <b>OpenTelemetry Collector</b>. On each server or VM it reports host metrics (CPU, load,
                memory, disk, network, processes), tails log files, receives OpenTelemetry data from your apps on ports 4317/4318, and relays it all to DataCat
                in batches with retries. For migrations it also accepts compatible tracers (port 8126) and StatsD clients (port 8125).
              </P>
              <H3>1. Install (Linux)</H3>
              <Code lang="shell">{`curl -fsSL ${URL}/install.sh | DATACAT_API_KEY=${KEY} sh`}</Code>
              <P>
                This downloads the agent to <C>/opt/datacat-agent/bin/datacat-agent</C>, writes <C>/etc/datacat/datacat.yaml</C> and, on systemd hosts, starts
                the <C>datacat-agent</C> service. Without systemd, start it yourself:
              </P>
              <Code lang="shell">{`/opt/datacat-agent/bin/datacat-agent run -c /etc/datacat/datacat.yaml`}</Code>
              <H3>2. Configure: /etc/datacat/datacat.yaml</H3>
              <Code lang="yaml">{`api_key: ${KEY}
url: ${URL}
env: prod
tags: [team:shop]
host_metrics:
  enabled: true
  interval: 15s
apm:
  otlp: true            # apps send OpenTelemetry to localhost:4317/4318
  datadog_compat: true  # Migration tracers can keep sending to localhost:8126
dogstatsd:
  enabled: true
  port: 8125
logs:
  - path: /var/log/myapp/*.log
    service: myapp
    source: nodejs`}</Code>
              <P>
                JSON log lines are parsed automatically: the level becomes the status, <C>message</C>/<C>msg</C> the log text, and <C>trace_id</C> links the log
                to its trace. Restart the agent after changing the file. To see the full OpenTelemetry Collector configuration the agent generates, run{" "}
                <C>datacat-agent config -c /etc/datacat/datacat.yaml</C>.
              </P>
              <H3>3. Check it worked</H3>
              <Steps>
                <li>
                  Your host appears in{" "}
                  <Link className="text-primary" href="/infrastructure">
                    Infrastructure
                  </Link>{" "}
                  and the{" "}
                  <Link className="text-primary" href="/infrastructure/map">
                    Host Map
                  </Link>{" "}
                  within a minute, with agent version shown.
                </li>
                <li>
                  Log lines from the configured files appear in the{" "}
                  <Link className="text-primary" href="/logs">
                    Log Explorer
                  </Link>{" "}
                  under their service.
                </li>
              </Steps>
              <Note>
                The agent listens on 127.0.0.1 only by default. In containers, set <C>listen: 0.0.0.0</C> and publish ports 4317, 4318, 8125/udp and 8126.
              </Note>
            </>
          )}

          {section === "nodejs" && (
            <>
              <H2>Node.js</H2>
              <P>
                <C>@datacat/trace</C> traces every request, ships logs that link to their traces, and records custom metrics, using the OpenTelemetry SDK under
                the hood. It instruments http, Express, Fastify, Koa, pg, mysql, redis, mongodb, fetch and more automatically.
              </P>
              <H3>1. Install</H3>
              <Code lang="shell">{`npm install ${URL}/downloads/datacat-trace-0.1.0.tgz express winston`}</Code>
              <H3>2. Write your app</H3>
              <Code lang="javascript">{`// app.js
const { metrics } = require('@datacat/trace');   // started by: node -r @datacat/trace/init
const express = require('express');
const winston = require('winston');
const logger = winston.createLogger({ level: 'info', format: winston.format.json(), transports: [new winston.transports.Console()] });

const app = express();
app.get('/checkout', (req, res) => {
  metrics.increment('checkout.attempts', 1, { plan: 'pro' });     // custom metric
  if (Math.random() < 0.3) {
    logger.error('payment declined', { order_id: 1234 });         // shipped to DataCat, linked to the trace
    return res.status(500).json({ error: 'payment declined' });
  }
  logger.info('checkout complete');
  res.json({ ok: true });
});
app.listen(3000);`}</Code>
              <H3>3. Run</H3>
              <P>
                With the{" "}
                <Link className="text-primary" href="/docs/agent">
                  DataCat Agent
                </Link>{" "}
                on the same machine:
              </P>
              <Code lang="shell">{`DATACAT_SERVICE=checkout DATACAT_ENV=prod DATACAT_VERSION=1.0.0 \\
node -r @datacat/trace/init app.js`}</Code>
              <P>Without an agent (serverless or containers), send straight to DataCat:</P>
              <Code lang="shell">{`DATACAT_URL=${URL} \\
DATACAT_API_KEY=${KEY} \\
DATACAT_SERVICE=checkout DATACAT_ENV=prod \\
node -r @datacat/trace/init app.js`}</Code>
              <P>
                Custom spans: <C>{`tracer.trace('checkout.calculate', { resource: 'cart' }, async (span) => { ... })`}</C>. Metrics: <C>metrics.increment</C>,{" "}
                <C>gauge</C>, <C>histogram</C>, <C>distribution</C> with tags as <C>{`{ key: 'value' }`}</C> or <C>['key:value']</C>. Store API keys in your
                deployment's secret manager or protected environment file.
              </P>
              <H3>4. Check it worked</H3>
              <Steps>
                <li>
                  Send a few requests: <C>curl localhost:3000/checkout</C>
                </li>
                <li>
                  Open{" "}
                  <Link className="text-primary" href="/apm/services">
                    APM
                  </Link>
                  : <b>checkout</b> appears with requests, latency and error rate.
                </li>
                <li>
                  Open the{" "}
                  <Link className="text-primary" href="/logs?query=service%3Acheckout">
                    Log Explorer
                  </Link>{" "}
                  filtered to <C>service:checkout</C>, click a log, then <b>View trace →</b>.
                </li>
                <li>
                  In the{" "}
                  <Link className="text-primary" href="/metric/explorer">
                    Metrics Explorer
                  </Link>
                  , graph{" "}
                  <C>
                    sum:checkout.attempts{"{*}"} by {"{plan}"}
                  </C>
                  .
                </li>
              </Steps>
            </>
          )}

          {section === "python" && (
            <>
              <H2>Python</H2>
              <P>
                <C>datacat-trace</C> traces requests, ships logs linked to their traces, and records custom metrics, using the OpenTelemetry SDK. It instruments
                Flask, Django, FastAPI, requests, urllib3, sqlite3, psycopg, redis and the logging module.
              </P>
              <H3>1. Install</H3>
              <Code lang="shell">{`pip install "datacat-trace[instrumentation] @ ${URL}/downloads/datacat_trace-0.1.0-py3-none-any.whl" flask`}</Code>
              <H3>2. Write your app</H3>
              <Code lang="python">{`# app.py
import logging
from flask import Flask, jsonify
from datacat import metrics

log = logging.getLogger("inventory")
logging.getLogger().setLevel(logging.INFO)
app = Flask(__name__)

@app.route("/stock")
def stock():
    level = 42
    metrics.gauge("inventory.stock_level", level, tags={"warehouse": "sfo"})   # custom metric
    log.info("stock checked: %s", level)                                       # shipped, linked to the trace
    return jsonify(level=level)

if __name__ == "__main__":
    app.run(port=8000)`}</Code>
              <H3>3. Run</H3>
              <P>
                With the{" "}
                <Link className="text-primary" href="/docs/agent">
                  DataCat Agent
                </Link>{" "}
                on the same machine:
              </P>
              <Code lang="shell">{`DATACAT_SERVICE=inventory DATACAT_ENV=prod datacat-run python app.py`}</Code>
              <P>Without an agent:</P>
              <Code lang="shell">{`DATACAT_URL=${URL} \\
DATACAT_API_KEY=${KEY} \\
DATACAT_SERVICE=inventory DATACAT_ENV=prod \\
datacat-run python app.py`}</Code>
              <P>
                Custom spans: <C>{`with tracer.trace("fulfillment.batch", resource="process"):`}</C> after <C>from datacat import tracer</C>.
              </P>
              <H3>4. Check it worked</H3>
              <Steps>
                <li>
                  <C>curl localhost:8000/stock</C> a few times.
                </li>
                <li>
                  <b>inventory</b> shows up in{" "}
                  <Link className="text-primary" href="/apm/services">
                    APM
                  </Link>
                  ; logs at{" "}
                  <Link className="text-primary" href="/logs?query=service%3Ainventory">
                    service:inventory
                  </Link>{" "}
                  link to their traces; graph{" "}
                  <C>
                    avg:inventory.stock_level{"{*}"} by {"{warehouse}"}
                  </C>
                  .
                </li>
              </Steps>
            </>
          )}

          {section === "migrate" && (
            <>
              <H2>Migrating from Datadog</H2>
              <P>DataCat accepts data from Datadog's open-source agent and tracers, so you can move one piece at a time.</P>
              <H3>Option A: keep your tracers, swap the agent</H3>
              <P>
                Install the{" "}
                <Link className="text-primary" href="/docs/agent">
                  DataCat Agent
                </Link>{" "}
                with <C>datadog_compat: true</C> (the default). Apps using <C>dd-trace</C>/<C>ddtrace</C> keep sending to <C>localhost:8126</C> and DogStatsD
                clients to <C>localhost:8125</C>; the DataCat Agent converts both to OpenTelemetry and forwards them.
              </P>
              <H3>Option B: switch libraries</H3>
              <table className={tableStyles({ className: "max-w-3xl my-3" })}>
                <thead>
                  <tr>
                    <th>Datadog</th>
                    <th>DataCat</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono text-xs">node -r dd-trace/init app.js</td>
                    <td className="mono text-xs">node -r @datacat/trace/init app.js</td>
                  </tr>
                  <tr>
                    <td className="mono text-xs">ddtrace-run python app.py</td>
                    <td className="mono text-xs">datacat-run python app.py</td>
                  </tr>
                  <tr>
                    <td className="mono text-xs">tracer.trace(name, opts, fn)</td>
                    <td className="mono text-xs">tracer.trace(name, {"{ resource, tags }"}, fn)</td>
                  </tr>
                  <tr>
                    <td className="mono text-xs">dogstatsd.increment / gauge / histogram</td>
                    <td className="mono text-xs">metrics.increment / gauge / histogram / distribution</td>
                  </tr>
                  <tr>
                    <td className="mono text-xs">DD_SERVICE, DD_ENV, DD_VERSION, DD_TAGS</td>
                    <td className="mono text-xs">DATACAT_SERVICE, DATACAT_ENV, DATACAT_VERSION, DATACAT_TAGS (DD_* read as fallbacks)</td>
                  </tr>
                  <tr>
                    <td className="mono text-xs">DD_LOGS_INJECTION=true + file tailing</td>
                    <td className="mono text-xs">on by default; logs ship over OTLP, no tailing needed</td>
                  </tr>
                </tbody>
              </table>
              <H3>Option C: point the Datadog Agent at DataCat</H3>
              <Code lang="yaml">{`# /etc/datadog-agent/datadog.yaml
api_key: ${KEY}
dd_url: ${URL}
logs_enabled: true
logs_config:
  use_http: true
  logs_dd_url: ${HOST}:443
apm_config:
  enabled: true
  apm_dd_url: ${URL}`}</Code>
              <P>
                Dashboards and monitors keep working across all three: DataCat derives the same <C>trace.*</C> request metrics and <C>system.*</C> host metrics
                whichever agent or library sent the data.
              </P>
            </>
          )}

          {section === "monitors" && (
            <>
              <H2>Alert on your app</H2>
              <P>Monitors check your data every 30 seconds and notify you when a threshold is crossed, and again when it recovers.</P>
              <H3>1. Add a notification channel</H3>
              <P>
                In{" "}
                <Link className="text-primary" href="/organization-settings?tab=integrations">
                  Organization Settings → Webhooks & Slack
                </Link>
                , add a webhook (any URL that accepts a JSON POST) or a Slack incoming-webhook URL. Give it a name, e.g. <C>oncall</C>; you mention it in
                monitors as <C>@webhook-oncall</C> or <C>@slack-oncall</C>.
              </P>
              <H3>2. Create a monitor</H3>
              <Steps>
                <li>
                  Go to{" "}
                  <Link className="text-primary" href="/monitors/create">
                    Monitors → New Monitor
                  </Link>{" "}
                  and pick a type:
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>
                      <b>Logs</b>: e.g. query <C>service:checkout status:error</C>, alert above <C>5</C> in the last 5 minutes.
                    </li>
                    <li>
                      <b>APM</b>: e.g. <C>service:checkout status:error</C> spans, or slow requests with <C>@duration:&gt;500ms</C>.
                    </li>
                    <li>
                      <b>Metric</b>: e.g.{" "}
                      <C>
                        avg:system.cpu.user{"{*}"} by {"{host}"}
                      </C>{" "}
                      above <C>90</C>, or your own <C>checkout.attempts</C>. Add <C>by {"{host}"}</C> to alert separately per host.
                    </li>
                  </ul>
                </li>
                <li>Set the alert threshold (and optionally a warning threshold).</li>
                <li>
                  Write the message and add the channel, e.g. <C>{"Checkout errors: {{value}} @webhook-oncall"}</C>. Use <C>{"{{#is_alert}}…{{/is_alert}}"}</C>{" "}
                  and <C>{"{{#is_recovery}}…{{/is_recovery}}"}</C> to vary the text.
                </li>
                <li>
                  Click <b>Create</b>. The monitor page shows its status, groups, state history, and every notification it sent.
                </li>
              </Steps>
              <H3>Webhook payload</H3>
              <Code lang="json">{`{
  "title": "[Triggered on service:checkout] Checkout errors",
  "body": "Checkout errors: 7",
  "monitor_id": 12, "monitor_name": "Checkout errors",
  "state": "Alert", "transition": "OK -> Alert",
  "value": 7, "threshold": 5, "group": "service:checkout",
  "tags": ["service:checkout"], "date": "2026-11-10T20:40:00.000Z"
}`}</Code>
            </>
          )}

          {section === "dashboards" && (
            <>
              <H2>Build a dashboard</H2>
              <Steps>
                <li>
                  <Link className="text-primary" href="/dashboard/lists?new=1">
                    Dashboards → New Dashboard
                  </Link>
                  , name it.
                </li>
                <li>
                  <b>Add Widget</b> → pick a visualization (Timeseries, Query Value, Top List, Table, Note, Group, Log Stream, Monitor Summary).
                </li>
                <li>
                  Build the query: metric, <i>from</i> (tag filters), <i>avg/sum/min/max by</i> (group). Add more queries and a formula such as{" "}
                  <C>a / b * 100</C>.
                </li>
                <li>
                  Pick a display and size, give it a title, <b>Save</b>; then <b>Save</b> the dashboard.
                </li>
                <li>
                  Add template variables in dashboard settings (e.g. <C>host</C>) and use <C>{"{$host}"}</C> in queries to filter every widget at once.
                </li>
              </Steps>
              <P>
                Dashboards export and import as JSON (widgets with <C>definition</C> and <C>layout</C> on a 12-column grid), so you can keep them in version
                control or create them via the API.
              </P>
            </>
          )}

          {section === "query-syntax" && (
            <>
              <H2>Query & search syntax</H2>
              <H3>Metric queries</H3>
              <Code>{`avg:system.cpu.user{env:prod,!host:db-*} by {host}
sum:checkout.attempts{*} by {plan}.as_count()
max:system.disk.in_use{device:/dev/sda1}.rollup(max, 300)
100 * sum:trace.express.request.errors{service:checkout}.as_count() / sum:trace.express.request.hits{service:checkout}.as_count()`}</Code>
              <P>
                Space aggregators: <C>avg sum min max count</C>. Filters: <C>key:value</C>, wildcards <C>*</C>, negation <C>!key:value</C>, <C>OR</C>,{" "}
                <C>key IN (a,b)</C>, template variables <C>$var</C>. Functions: <C>.rollup()</C>, <C>.as_count()</C>, <C>.as_rate()</C>, <C>.fill()</C>;
                formulas support <C>+ - * /</C>, <C>abs log10 cumsum diff derivative per_second per_minute count_nonzero top</C>.
              </P>
              <P>
                APM requests also produce metrics automatically: <C>trace.&lt;operation&gt;.hits</C>, <C>.errors</C>, <C>.duration</C> tagged with{" "}
                <C>service</C>, <C>resource_name</C>, <C>env</C> (for example <C>trace.express.request.hits</C>, <C>trace.flask.request.errors</C>).
              </P>
              <H3>Log & span search</H3>
              <Code>{`service:checkout status:error
@http.status_code:>=500 -host:canary-*
"payment declined" env:prod
service:(checkout OR inventory) @duration:>200ms
trace_id:1234567890`}</Code>
              <P>
                Reserved attributes (<C>service status host source env</C>, and for spans <C>resource_name operation_name</C>) filter directly; tags as{" "}
                <C>key:value</C>; event attributes with <C>@path.to.field</C>; numeric comparisons and <C>[a TO b]</C> ranges; free text searches the message.
              </P>
            </>
          )}

          {section === "http-api" && (
            <>
              <H2>HTTP API</H2>
              <H3>OpenTelemetry (OTLP/HTTP): POST /otlp/v1/traces, /otlp/v1/metrics, /otlp/v1/logs</H3>
              <P>
                Any OpenTelemetry SDK or Collector can send to DataCat directly. Use <C>{URL}/otlp</C> as the OTLP/HTTP endpoint and send your key in the{" "}
                <C>DC-API-KEY</C> header (or <C>Authorization: Bearer</C>). Protobuf and JSON bodies are accepted, plain or gzip.
              </P>
              <Code lang="shell">{`export OTEL_EXPORTER_OTLP_ENDPOINT=${URL}/otlp
export OTEL_EXPORTER_OTLP_HEADERS=DC-API-KEY=${KEY}
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`}</Code>
              <P>
                DataCat maps OpenTelemetry conventions onto its products: <C>service.name</C>, <C>deployment.environment</C> and <C>service.version</C> become
                service, env and version; HTTP server spans become <C>http.server.request</C> with resource <C>METHOD /route</C>; database spans become{" "}
                <C>&lt;db.system&gt;.query</C>; host metrics from the Collector's hostmetrics receiver feed the Infrastructure views; histograms produce{" "}
                <C>.avg</C>, <C>.count</C>, <C>.median</C>, <C>.95percentile</C> and <C>.99percentile</C> series.
              </P>
              <H3>Compatible agent intake</H3>
              <P>
                Intake endpoints take the <C>DD-API-KEY</C> header. Read and management endpoints also need an application key in <C>DD-APPLICATION-KEY</C>{" "}
                (create one in{" "}
                <Link className="text-primary" href="/organization-settings?tab=app-keys">
                  Organization Settings → Application Keys
                </Link>
                ). Bodies are JSON; gzip, deflate and zstd are accepted.
              </P>
              <H3>Submit metrics: POST /api/v2/series</H3>
              <Code lang="shell">{`curl -X POST "${URL}/api/v2/series" \\
  -H "DD-API-KEY: ${KEY}" -H "Content-Type: application/json" \\
  -d '{"series":[{"metric":"shop.orders","type":1,"points":[{"timestamp":'$(date +%s)',"value":3}],"tags":["env:prod"],"resources":[{"type":"host","name":"web-1"}]}]}'`}</Code>
              <P>
                Also <C>POST /api/v1/series</C> (<C>{`{"series":[{"metric","points":[[ts,value]],"host","tags","type"}]}`}</C>). Types: 0 unspecified, 1 count,
                2 rate, 3 gauge.
              </P>
              <H3>Send logs: POST /api/v2/logs</H3>
              <Code lang="shell">{`curl -X POST "${URL}/api/v2/logs" \\
  -H "DD-API-KEY: ${KEY}" -H "Content-Type: application/json" \\
  -d '[{"message":"user signed up","service":"web","ddsource":"curl","hostname":"web-1","status":"info","ddtags":"env:prod","usr":{"id":42}}]'`}</Code>
              <H3>Post an event: POST /api/v1/events</H3>
              <Code lang="shell">{`curl -X POST "${URL}/api/v1/events" -H "DD-API-KEY: ${KEY}" -H "DD-APPLICATION-KEY: <APP_KEY>" \\
  -H "Content-Type: application/json" -d '{"title":"Deployed v1.4.2","text":"checkout","tags":["service:checkout"]}'`}</Code>
              <H3>Query & manage</H3>
              <div className="text-[13px] max-w-3xl">
                <table className={tableStyles({ className: "bg-white border border-line rounded-lg" })}>
                  <thead>
                    <tr>
                      <th>Method & path</th>
                      <th>Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["GET /api/v1/validate", "Check an API key"],
                      ["GET /api/v1/query?from=&to=&query=", "Query a metric timeseries"],
                      ["POST /api/v2/query/timeseries", "Query with formulas"],
                      ["GET /api/v1/metrics", "List active metrics"],
                      ["GET /api/v1/hosts", "List hosts"],
                      ["POST /api/v2/logs/events/search", "Search logs"],
                      ["POST /api/v2/spans/events/search", "Search spans"],
                      ["GET|POST /api/v1/dashboard, GET|PUT|DELETE /api/v1/dashboard/:id", "Dashboards"],
                      ["GET|POST /api/v1/monitor, GET|PUT|DELETE /api/v1/monitor/:id, POST /api/v1/monitor/:id/mute", "Monitors"],
                      ["GET /api/v1/events", "List events"],
                    ].map(([a, b]) => (
                      <tr key={a}>
                        <td className="mono text-xs">{a}</td>
                        <td>{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <H3>Create a monitor via the API</H3>
              <Code lang="shell">{`curl -X POST "${URL}/api/v1/monitor" -H "DD-API-KEY: ${KEY}" -H "DD-APPLICATION-KEY: <APP_KEY>" \\
  -H "Content-Type: application/json" -d '{
    "name": "Checkout errors", "type": "log alert",
    "query": "logs(\\"service:checkout status:error\\").index(\\"*\\").rollup(\\"count\\").last(\\"5m\\") > 5",
    "message": "Checkout errors: {{value}} @webhook-oncall",
    "options": {"thresholds": {"critical": 5}}
  }'`}</Code>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
