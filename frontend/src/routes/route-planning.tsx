import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpDown,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  Info,
  Loader2,
  MapPin,
  Navigation,
  Route as RouteIcon,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Truck,
  AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { districts } from "@/data/districts";
import { useI18n } from "@/lib/i18n";
import { api, type NavStep, type RouteDetail, type RouteResponse, type HazardPoint } from "@/lib/api";

export const Route = createFileRoute("/route-planning")({
  head: () => ({
    meta: [
      { title: "Intelligent Safe Route Navigation — NER Access" },
      { name: "description", content: "Turn-by-turn road navigation comparing ML Safest Route vs Shortest Route across Northeast India." },
    ],
  }),
  component: Planner,
});

const VEHICLE_OPTIONS = [
  { id: "car", label: "Passenger Car", icon: Car },
  { id: "lorry", label: "Heavy Truck / Lorry", icon: Truck },
  { id: "emergency", label: "Ambulance / Emergency", icon: Siren },
];

function formatTime(minutes: number) {
  if (!minutes || minutes <= 0) return "15m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatMeters(meters: number) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

function getManeuverIcon(type?: string, modifier?: string) {
  if (type === "arrive") return <MapPin size={16} className="text-red-500 shrink-0" />;
  if (type === "depart") return <Navigation size={16} className="text-primary shrink-0" />;
  if (modifier?.includes("left")) return <CornerUpLeft size={16} className="text-primary shrink-0" />;
  if (modifier?.includes("right")) return <CornerUpRight size={16} className="text-primary shrink-0" />;
  return <Compass size={16} className="text-muted-foreground shrink-0" />;
}

function Planner() {
  const { t } = useI18n();
  const [start, setStart] = useState("d-guwahati");
  const [end, setEnd] = useState("d-dibrugarh");
  const [vehicle, setVehicle] = useState("car");
  const [routeType, setRouteType] = useState<"safest" | "shortest">("safest");
  const [loading, setLoading] = useState(false);
  const [showSteps, setShowSteps] = useState(true);
  const [routeResult, setRouteResult] = useState<RouteResponse | null>(null);

  const a = districts.find((d) => d.id === start) ?? districts[0];
  const b = districts.find((d) => d.id === end) ?? districts[1];

  const fetchRoute = async () => {
    if (!a || !b) return;
    setLoading(true);
    try {
      const res = await api.computeRoute({
        origin: { lat: a.lat, lon: a.lng },
        destination: { lat: b.lat, lon: b.lng },
        state: a.state || "Assam",
        vehicle_type: vehicle,
      });
      if (res) {
        setRouteResult(res);
      }
    } catch (err) {
      console.warn("Failed to fetch route:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoute();
  }, [start, end, vehicle]);

  const safestDetail: RouteDetail | null = routeResult?.recommended_route || null;
  const shortestDetail: RouteDetail | null = routeResult?.shortest_route || null;
  const activeDetail = routeType === "safest" ? (safestDetail || shortestDetail) : (shortestDetail || safestDetail);
  const alternateDetail = routeType === "safest" ? shortestDetail : safestDetail;

  const activePoints: [number, number][] = activeDetail?.coords || [];
  const altPoints: [number, number][] = alternateDetail?.coords || [];
  const hazards: HazardPoint[] = routeResult?.hazard_points || [];

  const handleSwap = () => {
    const temp = start;
    setStart(end);
    setEnd(temp);
  };

  const handleExportGoogleMaps = () => {
    if (!a || !b) return;
    const originParam = `${a.lat},${a.lng}`;
    const destParam = `${b.lat},${b.lng}`;
    let url = `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}&travelmode=driving`;

    // If safest route has detour waypoints, inject midpoints to force Google Maps to honor the safe corridor
    if (routeType === "safest" && activePoints.length > 20) {
      const mid1 = activePoints[Math.floor(activePoints.length * 0.4)];
      const mid2 = activePoints[Math.floor(activePoints.length * 0.7)];
      if (mid1 && mid2) {
        url += `&waypoints=${mid1[0].toFixed(5)},${mid1[1].toFixed(5)}|${mid2[0].toFixed(5)},${mid2[1].toFixed(5)}`;
      }
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <AppShell
      title="Intelligent Safe Route Navigation"
      description="Turn-by-turn road directions powered by real-world geometry and ML hazard predictions."
      routePoints={activePoints}
      altRoutePoints={altPoints}
      hazardPoints={hazards}
      routeType={routeType}
      onSelectRouteType={setRouteType}
    >
      <div className="space-y-3 pb-8">
        {/* Origin & Destination Selectors */}
        <section className="rounded-2xl border border-border/80 bg-secondary/50 p-4 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <RouteIcon size={18} className="text-primary" />
              <h2 className="text-sm font-semibold">{t("Corridor Selection")}</h2>
            </div>
            <button
              onClick={handleSwap}
              title="Swap origin and destination"
              className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/60 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowUpDown size={13} />
              <span>{t("Swap")}</span>
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr] items-center">
            <label className="text-[11px] font-medium text-muted-foreground">
              {t("Origin")}
              <select
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-xs font-medium text-foreground outline-none shadow-sm focus:ring-2 focus:ring-primary/40"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}, {d.state}
                  </option>
                ))}
              </select>
            </label>

            <div className="hidden sm:flex self-end pb-2 justify-center">
              <ArrowRight size={18} className="text-primary shrink-0" />
            </div>

            <label className="text-[11px] font-medium text-muted-foreground">
              {t("Destination")}
              <select
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-xs font-medium text-foreground outline-none shadow-sm focus:ring-2 focus:ring-primary/40"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}, {d.state}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Vehicle Type Selector */}
          <div className="mt-3 pt-3 border-t border-border/50">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              {t("Vehicle Profile & Clearance")}
            </span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {VEHICLE_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setVehicle(id)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all ${
                    vehicle === id
                      ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border/60 bg-card/40 text-muted-foreground hover:bg-card hover:text-foreground"
                  }`}
                >
                  <Icon size={14} />
                  <span className="truncate">{t(label)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Action Row: Recalculate & Export to Google Maps */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={fetchRoute}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
              {loading ? t("Computing Real Roads...") : t("Update Navigation")}
            </button>

            <button
              onClick={handleExportGoogleMaps}
              title="Export this exact route and navigation waypoints to Google Maps"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-sm"
            >
              <ExternalLink size={15} />
              <span>{t("Export to Google Maps")}</span>
            </button>
          </div>
        </section>

        {/* Route Comparison Selector: Safest vs Shortest */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card 1: Safest Route (ML Recommended) */}
          <div
            onClick={() => setRouteType("safest")}
            className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 shadow-md ${
              routeType === "safest"
                ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/40"
                : "border-border/80 bg-secondary/40 hover:bg-secondary/70 opacity-80"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={16} />
                {t("Safest Route (ML Recommended)")}
              </span>
              {routeType === "safest" && <CheckCircle2 size={16} className="text-emerald-500" />}
            </div>

            <div className="mt-2.5 flex items-baseline gap-3">
              <span className="text-xl font-bold font-display">
                {safestDetail ? `${safestDetail.distance_km} km` : "..."}
              </span>
              <span className="text-xs text-muted-foreground">
                {safestDetail ? formatTime(safestDetail.duration_min) : "..."}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs border-t border-border/50 pt-2">
              <span className="text-muted-foreground">{t("Predicted Risk:")}</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {safestDetail ? `${(safestDetail.risk_probability * 100).toFixed(0)}% (${safestDetail.risk_category || "Low"})` : "14% Low"}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
              {routeResult?.reason ? t(routeResult.reason) : t("Optimized path bypassing high-slope landslide sectors.")}
            </p>
          </div>

          {/* Card 2: Shortest Route */}
          {(() => {
            const isHighRisk = (shortestDetail?.risk_probability || 0) >= 0.40 || (shortestDetail?.blocked_segments || 0) > 0;
            return (
              <div
                onClick={() => setRouteType("shortest")}
                className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 shadow-md ${
                  routeType === "shortest"
                    ? isHighRisk
                      ? "border-red-500 bg-red-500/10 ring-2 ring-red-500/40"
                      : "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40"
                    : "border-border/80 bg-secondary/40 hover:bg-secondary/70 opacity-80"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 text-xs font-bold ${isHighRisk ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                    <AlertTriangle size={16} />
                    {isHighRisk ? t("Shortest Route (Direct — High Risk)") : t("Shortest Route (Direct)")}
                  </span>
                  {routeType === "shortest" && (
                    <CheckCircle2 size={16} className={isHighRisk ? "text-red-500" : "text-amber-500"} />
                  )}
                </div>

                <div className="mt-2.5 flex items-baseline gap-3">
                  <span className="text-xl font-bold font-display">
                    {shortestDetail ? `${shortestDetail.distance_km} km` : "..."}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {shortestDetail ? formatTime(shortestDetail.duration_min) : "..."}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs border-t border-border/50 pt-2">
                  <span className="text-muted-foreground">{t("Predicted Risk:")}</span>
                  <span className={`font-semibold ${isHighRisk ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {shortestDetail ? `${(shortestDetail.risk_probability * 100).toFixed(0)}% (${t(shortestDetail.risk_category || "Critical")})` : `68% ${t("Critical")}`}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
                  {shortestDetail?.blocked_segments && shortestDetail.blocked_segments > 0
                    ? `⛔ ${t("Blocked segments:")} ${shortestDetail.blocked_segments} — ${t("Contains red hazard points")}`
                    : t("Direct highway corridor with active hazard zones.")}
                </p>
              </div>
            );
          })()}
        </section>

        {/* Real Danger Points Along Route */}
        {hazards.length > 0 && (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
              <AlertTriangle size={15} />
              <span>{t("Real-World Danger Points Detected on Route")} ({hazards.length})</span>
            </div>
            <div className="mt-2 divide-y divide-red-500/20 text-xs">
              {hazards.slice(0, 4).map((h, i) => (
                <div key={h.id || i} className="py-1.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-foreground">{t(h.type)}: </span>
                    <span className="text-muted-foreground">{t(h.description)}</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-600 dark:text-red-300 font-bold shrink-0 ml-2">
                    {t(h.risk_level)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Turn-by-Turn Navigation Instructions (Google Maps Style) */}
        <section className="rounded-2xl border border-border/80 bg-secondary/50 backdrop-blur-xl shadow-lg overflow-hidden">
          <div
            onClick={() => setShowSteps(!showSteps)}
            className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-card/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Navigation size={17} className="text-primary" />
              <div>
                <h3 className="text-sm font-semibold">
                  {t("Turn-by-Turn Directions")}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {activeDetail?.nav_steps?.length || 0} {t("navigation instructions")} · {formatTime(activeDetail?.duration_min || 0)}
                </p>
              </div>
            </div>
            <button className="text-muted-foreground hover:text-foreground">
              {showSteps ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          {showSteps && (
            <div className="border-t border-border/60 divide-y divide-border/40 max-h-96 overflow-y-auto p-2 bg-card/20">
              {activeDetail?.nav_steps && activeDetail.nav_steps.length > 0 ? (
                activeDetail.nav_steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 flex items-start gap-3 hover:bg-secondary/40 rounded-xl transition-colors text-xs"
                  >
                    <div className="mt-0.5 p-1.5 rounded-lg bg-secondary border border-border/60 shrink-0">
                      {getManeuverIcon(step.type, step.modifier)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground leading-snug">
                        {t(step.instruction)}
                      </p>
                      {step.name && step.name !== "Road" && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {t("via")} {step.name}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-medium text-foreground">
                        {formatMeters(step.distance_m)}
                      </span>
                      {step.duration_s > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          {formatTime(step.duration_s / 60)}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  <Info size={16} className="mx-auto mb-1 opacity-60" />
                  {t("Calculating turn-by-turn road steps...")}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}