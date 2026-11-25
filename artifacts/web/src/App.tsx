import { Route, Switch, Redirect, useLocation } from "wouter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Layout } from "@/components/Layout";
import { TimeProvider } from "@/lib/time";
import { useAuthUser } from "@/lib/auth";
import { DashboardList, DashboardView } from "@/pages/Dashboards";
import { InfraList, HostMap } from "@/pages/Infrastructure";
import { MetricsExplorer, MetricsSummary } from "@/pages/Metrics";
import { MonitorList, MonitorEdit, MonitorStatus } from "@/pages/Monitors";
import { LogsExplorer } from "@/pages/Logs";
import { ApmServices, ApmService, TraceExplorer, TraceView } from "@/pages/Apm";
import { Events, OrgSettings, AgentSetup, Home, Login } from "@/pages/Misc";
import { Docs } from "@/pages/Docs";

export default function App() {
  const auth = useAuthUser();
  const [loc] = useLocation();
  if (auth.isLoading) return <div className="h-full flex items-center justify-center text-ink-3">Loading…</div>;
  if (!auth.user || loc.startsWith("/invite/")) return <Login restricted={auth.data?.restricted} email={auth.data?.email} />;
  return (
    <Layout>
      <TimeProvider>
        <ErrorBoundary resetKey={loc}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/dashboard/lists" component={DashboardList} />
            <Route path="/dashboard/:id">{(p: { id: string }) => <DashboardView key={p.id} />}</Route>
            <Route path="/infrastructure" component={InfraList} />
            <Route path="/infrastructure/map" component={HostMap} />
            <Route path="/metric/explorer" component={MetricsExplorer} />
            <Route path="/metric/summary" component={MetricsSummary} />
            <Route path="/monitors/manage" component={MonitorList} />
            <Route path="/monitors/create" component={MonitorEdit} />
            <Route path="/monitors/:id/edit" component={MonitorEdit} />
            <Route path="/monitors/:id" component={MonitorStatus} />
            <Route path="/logs" component={LogsExplorer} />
            <Route path="/apm/services" component={ApmServices} />
            <Route path="/apm/services/:service" component={ApmService} />
            <Route path="/apm/traces" component={TraceExplorer} />
            <Route path="/apm/trace/:traceId" component={TraceView} />
            <Route path="/event/explorer" component={Events} />
            <Route path="/organization-settings" component={OrgSettings} />
            <Route path="/account/agent" component={AgentSetup} />
            <Route path="/docs" component={Docs} />
            <Route path="/docs/:section" component={Docs} />
            <Route path="/search">
              <Redirect to="/" />
            </Route>
            <Route path="/events">
              <Redirect to="/event/explorer" />
            </Route>
            <Route path="/dashboards">
              <Redirect to="/dashboard/lists" />
            </Route>
            <Route path="/monitors">
              <Redirect to="/monitors/manage" />
            </Route>
            <Route path="/apm">
              <Redirect to="/apm/services" />
            </Route>
            <Route path="/metrics">
              <Redirect to="/metric/explorer" />
            </Route>
            <Route>
              <div className="p-10 text-ink-2">Page not found.</div>
            </Route>
          </Switch>
        </ErrorBoundary>
      </TimeProvider>
    </Layout>
  );
}
