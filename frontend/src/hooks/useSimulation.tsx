import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { alerts as seedAlerts, alertTemplates, type Alert, type AlertLevel } from "@/data/alerts";
import { vehicles as seedVehicles, type Vehicle } from "@/data/vehicles";
import { districts } from "@/data/districts";
import { dashboardStats } from "@/data/dashboardStats";
import { api, API_BASE, type BackendAlert, type BackendVehicle } from "@/lib/api";

export type LiveStats = typeof dashboardStats & {
  activeDisruptions?: number;
  blockedRoads?: number;
  districtsAtRisk?: number;
  criticalCorridors?: number;
  activeVehicles?: number;
  delayedDeliveries?: number;
};

type SimulationValue = {
  now: Date;
  liveAlerts: Alert[];
  liveVehicles: Vehicle[];
  liveStats: LiveStats;
  feedPulse: number;
  backendConnected: boolean;
  acknowledge: (id: string) => void;
  refreshBackend: () => Promise<void>;
};

const SimulationContext = createContext<SimulationValue | null>(null);

let syntheticId = 0;

function nudge(value: number, spread: number, min: number, max: number) {
  const next = value + (Math.random() - 0.5) * spread;
  return Math.min(max, Math.max(min, next));
}

function mapBackendAlert(ba: BackendAlert): Alert {
  const levelMap: Record<string, AlertLevel> = {
    critical: "critical",
    high: "warning",
    medium: "watch",
    low: "info",
  };
  const dist = districts.find(
    (d) =>
      d.name.toLowerCase().includes(ba.district?.toLowerCase() || "") ||
      (ba.district && d.id.toLowerCase().includes(ba.district.toLowerCase())) ||
      d.state.toLowerCase().includes(ba.state?.toLowerCase() || "")
  );
  return {
    id: ba.id,
    level: levelMap[ba.severity] || "warning",
    title: ba.title,
    message: ba.message,
    districtId: dist ? dist.id : "d-imphal",
    issuedAt: ba.timestamp || new Date().toISOString(),
    channel: ba.severity === "critical" ? "Control Room" : "SMS",
    acknowledged: !!ba.acknowledged,
    category: ba.type === "landslide" ? "Landslide" : ba.type === "flood" ? "Flood" : "Road Blockage",
    lat: ba.lat ?? dist?.lat,
    lon: ba.lon ?? dist?.lng,
  };
}

function mapBackendVehicle(bv: BackendVehicle, idx: number): Vehicle {
  const statusMap: Record<string, any> = {
    "In Transit": "moving",
    Delayed: "delayed",
    Stopped: "stopped",
    Emergency: "emergency",
    Offline: "offline",
  };
  const dist = districts.find(
    (d) =>
      d.name.toLowerCase().includes(bv.destination?.toLowerCase() || "") ||
      d.state.toLowerCase().includes(bv.state?.toLowerCase() || "")
  );
  return {
    id: bv.id || `v-${idx + 1}`,
    callSign: bv.call_sign || `NER-VEH-${idx + 1}`,
    type: (bv.type as any) || "Medical Supply Vehicle",
    crew: 3,
    status: statusMap[bv.status] || "moving",
    fuel: bv.fuel_pct || 75,
    districtId: dist ? dist.id : "d-imphal",
    destination: bv.destination || "Imphal",
    cargo: bv.cargo || "Emergency Relief",
    eta: bv.eta || "2h 15m",
    lat: bv.lat || 24.817,
    lng: bv.lon || 93.944,
    heading: bv.heading || 45,
    speed: bv.speed_kmh || 40,
  };
}

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(() => new Date());
  const [liveAlerts, setLiveAlerts] = useState<Alert[]>(seedAlerts);
  const [liveVehicles, setLiveVehicles] = useState<Vehicle[]>(seedVehicles);
  const [liveStats, setLiveStats] = useState<LiveStats>({
    ...dashboardStats,
    activeDisruptions: 24,
    blockedRoads: 17,
    districtsAtRisk: 12,
    criticalCorridors: 8,
    activeVehicles: 42,
    delayedDeliveries: 19,
  });
  const [feedPulse, setFeedPulse] = useState(0);
  const [backendConnected, setBackendConnected] = useState(false);
  const tick = useRef(0);

  const syncBackend = async () => {
    try {
      const [status, kpiData, alertsData, vehiclesData] = await Promise.all([
        api.getStatus(),
        api.getKpis(),
        api.getAlerts(),
        api.getVehicles(),
      ]);

      if (status) {
        setBackendConnected(true);
      }

      if (kpiData) {
        setLiveStats((prev) => ({
          ...prev,
          activeIncidents: kpiData.total_active_alerts,
          reliefTrucksMoving: kpiData.vehicles_in_transit,
          activeDisruptions: kpiData.total_active_alerts,
          blockedRoads: kpiData.blocked_roads,
          districtsAtRisk: kpiData.districts_at_risk,
          criticalCorridors: kpiData.critical_segments,
          activeVehicles: kpiData.vehicles_in_transit,
          delayedDeliveries: kpiData.caution_segments,
        }));
      }

      if (alertsData?.alerts && alertsData.alerts.length > 0) {
        const mapped = alertsData.alerts.map(mapBackendAlert);
        setLiveAlerts(mapped);
      }

      if (vehiclesData?.vehicles && vehiclesData.vehicles.length > 0) {
        const mapped = vehiclesData.vehicles.map(mapBackendVehicle);
        setLiveVehicles(mapped);
      }
      setFeedPulse((p) => p + 1);
    } catch (err) {
      console.warn("[Simulation] Backend sync warning:", err);
      setBackendConnected(false);
    }
  };

  useEffect(() => {
    // Initial sync with backend
    syncBackend();

    // Clock ticker
    const clock = window.setInterval(() => setNow(new Date()), 1000);

    // Periodic backend poll (every 6 seconds)
    const backendPoll = window.setInterval(() => {
      syncBackend();
    }, 6000);

    // Simulated micro-movement for vehicles between backend updates
    const movement = window.setInterval(() => {
      setLiveVehicles((prev) =>
        prev.map((v) =>
          v.status === "offline" || v.status === "stopped"
            ? v
            : {
                ...v,
                lat: nudge(v.lat, 0.005, 22.2, 29.4),
                lng: nudge(v.lng, 0.005, 88.3, 97.4),
                heading: (v.heading + Math.round((Math.random() - 0.5) * 12) + 360) % 360,
                speed: Math.max(10, Math.round(nudge(v.speed || 25, 6, 4, 68))),
              }
        )
      );
    }, 2000);

    // Live Server-Sent Events (SSE) stream from backend if available
    let sse: EventSource | null = null;
    try {
      const sseUrl = `${API_BASE}/api/stream/alerts`;
      sse = new EventSource(sseUrl);
      sse.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          if (raw && raw.title) {
            const fresh = mapBackendAlert(raw);
            setLiveAlerts((prev) => [fresh, ...prev.filter((x) => x.id !== fresh.id)].slice(0, 30));
            setFeedPulse((p) => p + 1);
          }
        } catch {}
      };
      sse.onerror = () => {
        // SSE fallback handled by polling
      };
    } catch {}

    return () => {
      window.clearInterval(clock);
      window.clearInterval(backendPoll);
      window.clearInterval(movement);
      if (sse) sse.close();
    };
  }, []);

  const value = useMemo<SimulationValue>(
    () => ({
      now,
      liveAlerts,
      liveVehicles,
      liveStats,
      feedPulse,
      backendConnected,
      acknowledge: (id) =>
        setLiveAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
        ),
      refreshBackend: syncBackend,
    }),
    [now, liveAlerts, liveVehicles, liveStats, feedPulse, backendConnected]
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error("useSimulation must be used inside SimulationProvider");
  return ctx;
}
