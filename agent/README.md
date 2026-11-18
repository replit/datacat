# DataCat Agent

DataCat Agent is a single native host agent built with OpenTelemetry Collector
Builder. Version **0.1.0** pins Collector/contrib **0.165** (stable Collector
configuration providers **1.41.0**). No additional collector process, shell
translation wrapper, or runtime Go installation is needed.

## Install and run

The easiest install is the one-line installer from your DataCat instance (**Organization Settings → Install agent**,
see `docs/SELF_HOSTING.md`). It puts the binary in `/opt/datacat-agent/bin/datacat-agent` and the configuration in
`/etc/datacat/datacat.yaml` (contains credentials; mode `0600`). To install by hand:

```sh
sudo install -d -m 0755 /opt/datacat-agent/bin /etc/datacat /var/lib/datacat-agent
sudo install -m 0755 datacat-agent /opt/datacat-agent/bin/datacat-agent
sudo install -m 0600 datacat.example.yaml /etc/datacat/datacat.yaml
export DATACAT_API_KEY='your-organization-api-key'
/opt/datacat-agent/bin/datacat-agent run -c /etc/datacat/datacat.yaml
```

Use a service account with read permission on the configured log files and write
permission on `state_dir`. Root is not required for most host counters. The
example uses local-only receiver bindings; expose them only on trusted networks.
Use HTTPS when sending to a remote DataCat installation.

```sh
datacat-agent version
datacat-agent config -c /etc/datacat/datacat.yaml
# Explicitly opt in to printing credentials; do not paste this output into tickets:
datacat-agent config -c /etc/datacat/datacat.yaml --show-secrets
# Unmodified Collector configuration is also supported:
datacat-agent collector --config /path/to/collector.yaml
datacat-agent collector validate --config /path/to/collector.yaml
```

`config` defaults to redacting the API key. Generated configuration otherwise
matches what `run` uses. Translation and JSON normalization are compiled into the
binary. SIGTERM/SIGINT shut the Collector down cleanly.

## Configuration reference

`datacat.example.yaml` is a complete example that tails the logs of the five Acme Shop services (`examples/acme-shop`).

| Field | Default / behavior |
|---|---|
| `api_key` | Required; literal key or `${ENV_VAR}` |
| `url` | `http://localhost:3000`; DataCat base URL **without** `/otlp` |
| `hostname` | Optional override of detected OS hostname |
| `env` | Optional; falls back to `DATACAT_ENV`, then `DD_ENV` |
| `tags` | List of `key:value` resource attributes |
| `host_metrics.enabled` | `true` |
| `host_metrics.interval` | `15s`; positive Go duration |
| `apm.otlp` | `true`; enables OTLP gRPC `4317` and HTTP `4318`, all signals |
| `apm.datadog_compat` | `true`; upstream compatibility trace receiver on HTTP `8126` |
| `dogstatsd.enabled` | `true`; tagged StatsD-compatible UDP intake |
| `dogstatsd.port` | `8125`; counters are monotonic, aggregation every `15s` |
| `listen` | `127.0.0.1`; receiver/health-check bind address |
| `state_dir` | `/var/lib/datacat-agent`; persistent file offsets |
| `logs` | List of log inputs described below |
| `debug` | `false`; when true, additionally exports detailed telemetry to stderr |

`api_key`, `url`, `hostname`, and `env` support whole-value `${ENV_VAR}`
substitution. Missing environment variables, unknown fields, invalid durations,
invalid tags, and configurations with no inputs produce explicit startup errors.
Reserved resource keys must be configured using their dedicated fields.

Each log input has required `path` (glob allowed) and `service`, optional `source`
and `tags`, and optional `start_at` (`end` by default; `beginning` for initial
backfills). Persisted offsets take precedence on subsequent starts.

JSON lines retain structured fields as attributes. Body comes from `message` or
`msg`; severity from `level`, `status`, or `severity`; RFC3339 timestamps from
`timestamp`, `time`, or `@timestamp`. Trace context accepts top-level
`trace_id`/`span_id`, dotted `dd.trace_id`/`dd.span_id`, and nested `dd` objects.
Hex IDs and migration-format decimal IDs, including unsigned 64-bit IDs, are
normalized without floating-point precision loss. Malformed JSON and invalid IDs
are retained, explicitly marked with `datacat.parse_error`, and reported by the
operator rather than silently discarded.

Host scrapers cover CPU (including utilization), load, memory (including
utilization), filesystem, disk, network, paging, and processes. System resource
detection adds `host.name` and `os.type`; resource processing adds configured
environment/tags and `datacat.agent.version`. File inputs set `service.name`
independently. The cumulative-to-delta processor converts supported monotonic
counters/histograms to DELTA; initial cumulative values are dropped until a second
sample. Gauges remain gauges.

All pipelines use memory limiting and batching, then gzip-compressed OTLP/HTTP
with `DC-API-KEY` to `<url>/otlp/v1/{metrics,logs,traces}`. Retry is indefinite
with a bounded in-memory queue (1,000 requests, two consumers). Queue data is not
durable across crashes; file offsets are durable. The health endpoint is
`http://127.0.0.1:13133/`. Detailed debug output can contain sensitive log/span
payloads: enable it only for controlled diagnosis.

## Migration

Stop the previous host agent before starting DataCat Agent, since ports `8125`
and `8126` overlap. Do not uninstall it until migration is verified.

Existing instrumented applications can keep sending compatibility traces to
`http://127.0.0.1:8126` (`/v0.4/traces` and upstream-supported trace protocol
versions). New instrumentation should use:

```sh
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=DELTA
OTEL_SERVICE_NAME=my-service
```

Preserve service/environment identity in instrumentation and the log input
configuration. Existing tagged UDP metrics continue to use `8125`.
Compatibility is for trace and StatsD wire protocols, **not** an implementation
of legacy checks, process monitoring, remote configuration, profiling, security
agents, or the complete legacy agent management API. Compatibility `/intake`
proxying is disabled; no upstream vendor credentials or forwarding are used.

## Build

Install Go 1.26.11 or newer and ensure `go` is on your PATH.

```sh
cd agent
./build.sh
# Optional installation destination:
DESTDIR=/tmp/datacat-bin ./build.sh
```

The script installs OCB `0.165.0` if necessary, generates the component factories
from `manifest.yaml`, copies the custom main/config/JSON operator into the
generated module, runs unit tests, and builds a stripped, trimpath-enabled binary.
Generated modules and binaries are gitignored. Build output defaults to
`agent/dist/datacat-agent`. OCB's generated platform entry points are
retained; the custom main implements `run`, `config`, and raw Collector commands.
All requested upstream components, including the compatibility receiver, build
successfully.

## Verification

`verify.sh` starts a temporary agent next to a running DataCat (it never touches an installed agent), sends a test
span, a tagged StatsD counter and a log line through it, and checks that each one reached DataCat:

```sh
DATACAT_URL=http://localhost:3000 DATACAT_API_KEY=<api key> AGENT=agent/dist/datacat-agent bash agent/verify.sh
```

Footprint, measured on a 4 vCPU Linux VM with only host metrics enabled for 60 s: about 70 MB RSS and 0.2% of one
CPU. The stripped binary is about 136 MB (Collector 0.165). Under the Acme Shop workload the agent used 82–90 MB.
