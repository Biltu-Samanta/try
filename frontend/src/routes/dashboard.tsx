import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Gauge, Route as RouteIcon, Truck, PackageX, MapPinned } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSimulation } from "@/hooks/useSimulation";
import { useI18n } from "@/lib/i18n";
import {
  corridorDelays,
  disruptionMix,
  incidentTrend,
  regionalRisk,
} from "@/data/dashboardStats";

export const RouteDef = {
  title: "NER Logistics Intelligence",
  description: "Live accessibility, corridor conditions, essential-goods movement and transport disruptions across North East India.",
};

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "NER Logistics Intelligence Dashboard" },
      { name: "description", content: RouteDef.description },
      { property: "og:title", content: "NER Logistics Intelligence Dashboard" },
      { property: "og:description", content: RouteDef.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { liveAlerts, liveStats, backendConnected } = useSimulation();
  const { t } = useI18n();

  const metrics = [
    { label: "Active Disruptions", value: String(liveStats.activeDisruptions ?? 24), icon: AlertTriangle, tone: "text-critical" },
    { label: "Blocked Roads", value: String(liveStats.blockedRoads ?? 17), icon: PackageX, tone: "text-critical" },
    { label: "Districts at Risk", value: String(liveStats.districtsAtRisk ?? 12), icon: MapPinned, tone: "text-warning" },
    { label: "Critical Corridors", value: String(liveStats.criticalCorridors ?? 8), icon: RouteIcon, tone: "text-warning" },
    { label: "Active Vehicles", value: String(liveStats.activeVehicles ?? 42), icon: Truck, tone: "text-primary" },
    { label: "Delayed Deliveries", value: String(liveStats.delayedDeliveries ?? 19), icon: Gauge, tone: "text-watch" },
  ];

  return (
    <AppShell title="NER Logistics Intelligence Dashboard" description={RouteDef.description}>
      <div className="mb-3 flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5 text-xs">
        <span className="flex items-center gap-2">
          <span className={`inline-block size-2 rounded-full ${backendConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
          <span className="font-medium text-foreground">
            {backendConnected ? t("Python ML Engine Connected (Port 5050)") : t("Connecting to ML Backend (http://localhost:5050)...")}
          </span>
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">{t("Real Datasets + ML Inference")}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="dashboard-interactive glass-reflective rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{t(label)}</span>
              <Icon size={14} className={`${tone} dashboard-interactive-icon`} />
            </div>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1.2fr_.8fr]">
        <section className="dashboard-interactive glass-reflective rounded-xl p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("Connectivity trend")}</h2>
            <span className="text-[10px] text-safe">{t("Live")}</span>
          </div>
          <div className="h-40">
            <ResponsiveContainer>
              <AreaChart data={incidentTrend}>
                <defs>
                  <linearGradient id="access" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--primary)" stopOpacity={0.7} />
                    <stop offset="1" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" hide />
                <Tooltip />
                <Area dataKey="incidents" stroke="var(--primary)" fill="url(#access)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="dashboard-interactive glass-reflective rounded-xl p-3">
          <h2 className="text-sm font-semibold">{t("Priority feed")}</h2>
          <div className="mt-2 space-y-2">
            {liveAlerts.slice(0, 4).map((a) => (
              <div key={a.id} className="border-l-2 border-critical pl-2">
                <p className="text-xs font-medium">{t(a.title)}</p>
                <p className="text-[10px] text-muted-foreground">{t(a.category)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <section className="dashboard-interactive glass-reflective rounded-xl p-3">
          <h2 className="text-sm font-semibold">{t("Corridor delays")}</h2>
          <p className="text-[10px] text-muted-foreground">{t("Average delay in minutes")}</p>
          <div className="mt-2 h-36">
            <ResponsiveContainer>
              <BarChart data={corridorDelays} layout="vertical" margin={{ left: -18, right: 8 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="corridor" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <Tooltip cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="minutes" fill="var(--warning)" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="dashboard-interactive glass-reflective rounded-xl p-3">
          <h2 className="text-sm font-semibold">{t("Disruption mix")}</h2>
          <p className="text-[10px] text-muted-foreground">{t("Share of active incidents")}</p>
          <div className="flex h-36 items-center">
            <div className="h-full flex-1">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={disruptionMix} dataKey="value" nameKey="name" innerRadius={34} outerRadius={53} paddingAngle={3}>
                    {disruptionMix.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
              {disruptionMix.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-[10px]">
                  <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{t(item.name)}</span>
                  <span className="font-medium tabular-nums">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="dashboard-interactive glass-reflective rounded-xl p-3">
          <h2 className="text-sm font-semibold">{t("Regional risk index")}</h2>
          <p className="text-[10px] text-muted-foreground">{t("Current accessibility pressure")}</p>
          <div className="mt-2 h-36">
            <ResponsiveContainer>
              <BarChart data={regionalRisk}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="state" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="risk" fill="var(--critical)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
