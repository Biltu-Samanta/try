import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { districts } from "@/data/districts";
import { useSimulation } from "@/hooks/useSimulation";
import { useI18n } from "@/lib/i18n";
import { api, type BackendSegment, type HazardPoint } from "@/lib/api";

const riskColor = {
  critical: "var(--critical, #EF4444)",
  high: "var(--warning, #F59E0B)",
  moderate: "var(--watch, #3B82F6)",
  low: "var(--safe, #10B981)",
};

function MapBoundsUpdater({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 1) {
      try {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
      } catch {}
    }
  }, [points, map]);
  return null;
}

const TILE_LAYERS = {
  "3D": {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    maxZoom: 19,
  },
  Terrain: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, METI, MapmyIndia",
    maxZoom: 18,
  },
  "2D": {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  },
};

export interface LiveMapProps {
  className?: string;
  routePoints?: [number, number][];
  altRoutePoints?: [number, number][];
  hazardPoints?: HazardPoint[];
  routeType?: "safest" | "shortest";
  onSelectRouteType?: (type: "safest" | "shortest") => void;
  mapMode?: "2D" | "3D" | "Terrain";
}

// Built-in regional road segments across all 8 Northeast states ensuring red dots & status dots are always visible
const FALLBACK_SEGMENTS: BackendSegment[] = [
  // Manipur
  { id: "SEG0191", name: "NH-2 Imphal-Jiribam Sector 1", road_name: "NH-2", state: "Manipur", district: "Imphal West", lat: 24.8155, lon: 93.9126, risk_probability: 0.78, risk_percentage: "78%", status: "blocked", slope_degrees: 38.5, distance_to_river_km: 1.2, past_landslides: 6, rainfall_mm: 88 },
  { id: "SEG0195", name: "NH-2 Noney-Jiribam Valley", road_name: "NH-2", state: "Manipur", district: "Tamenglong", lat: 24.7798, lon: 93.6890, risk_probability: 0.84, risk_percentage: "84%", status: "blocked", slope_degrees: 41.2, distance_to_river_km: 0.8, past_landslides: 8, rainfall_mm: 95 },
  { id: "SEG0228", name: "NH-150 Imphal-Senapati Pass", road_name: "NH-150", state: "Manipur", district: "Senapati", lat: 25.0098, lon: 93.9503, risk_probability: 0.72, risk_percentage: "72%", status: "blocked", slope_degrees: 37.4, distance_to_river_km: 2.1, past_landslides: 5, rainfall_mm: 74 },
  { id: "SEG0211", name: "NH-37 Imphal-Moreh Corridor", road_name: "NH-37", state: "Manipur", district: "Chandel", lat: 24.5544, lon: 94.0914, risk_probability: 0.44, risk_percentage: "44%", status: "caution", slope_degrees: 26.1, distance_to_river_km: 4.5, past_landslides: 3, rainfall_mm: 52 },
  { id: "SEG0235", name: "Imphal-Churachandpur Highway", road_name: "Tiddim Road", state: "Manipur", district: "Churachandpur", lat: 24.6023, lon: 93.8289, risk_probability: 0.16, risk_percentage: "16%", status: "open", slope_degrees: 14.5, distance_to_river_km: 5.8, past_landslides: 0, rainfall_mm: 22 },
  { id: "SEG0240", name: "Imphal-Bishnupur Arterial", road_name: "State Highway 1", state: "Manipur", district: "Bishnupur", lat: 24.7915, lon: 93.9230, risk_probability: 0.12, risk_percentage: "12%", status: "open", slope_degrees: 11.2, distance_to_river_km: 6.2, past_landslides: 0, rainfall_mm: 18 },
  // Assam
  { id: "SEG0115", name: "NH-37 Kaziranga Flood Inundation Cut", road_name: "NH-37", state: "Assam", district: "Golaghat", lat: 26.5820, lon: 93.1540, risk_probability: 0.81, risk_percentage: "81%", status: "blocked", slope_degrees: 8.0, distance_to_river_km: 0.3, past_landslides: 1, rainfall_mm: 115 },
  { id: "SEG0128", name: "Guwahati-Nagaon 4-Lane Highway", road_name: "NH-27", state: "Assam", district: "Kamrup", lat: 26.2100, lon: 92.1500, risk_probability: 0.10, risk_percentage: "10%", status: "open", slope_degrees: 6.5, distance_to_river_km: 7.2, past_landslides: 0, rainfall_mm: 20 },
  { id: "SEG0142", name: "Dibrugarh River Approach Road", road_name: "NH-15", state: "Assam", district: "Dibrugarh", lat: 27.4728, lon: 94.9120, risk_probability: 0.65, risk_percentage: "65%", status: "blocked", slope_degrees: 9.2, distance_to_river_km: 0.4, past_landslides: 0, rainfall_mm: 92 },
  { id: "SEG0155", name: "Silchar-Badarpur Valley Corridor", road_name: "NH-37", state: "Assam", district: "Cachar", lat: 24.8333, lon: 92.7789, risk_probability: 0.48, risk_percentage: "48%", status: "caution", slope_degrees: 22.0, distance_to_river_km: 1.8, past_landslides: 2, rainfall_mm: 64 },
  // Sikkim
  { id: "SEG0088", name: "NH-10 Teesta Gorge Landslide Zone", road_name: "NH-10", state: "Sikkim", district: "Gangtok", lat: 27.2800, lon: 88.5500, risk_probability: 0.88, risk_percentage: "88%", status: "blocked", slope_degrees: 44.0, distance_to_river_km: 0.2, past_landslides: 12, rainfall_mm: 120 },
  // Meghalaya
  { id: "SEG0074", name: "NH-6 Jowai Cliff Rockfall Sector", road_name: "NH-6", state: "Meghalaya", district: "East Jaintia Hills", lat: 25.4800, lon: 92.1500, risk_probability: 0.79, risk_percentage: "79%", status: "blocked", slope_degrees: 39.0, distance_to_river_km: 2.0, past_landslides: 7, rainfall_mm: 110 },
  { id: "SEG0078", name: "Shillong-Guwahati Expressway Bypass", road_name: "GS Road", state: "Meghalaya", district: "Ri Bhoi", lat: 25.7500, lon: 91.8900, risk_probability: 0.15, risk_percentage: "15%", status: "open", slope_degrees: 18.0, distance_to_river_km: 6.5, past_landslides: 1, rainfall_mm: 35 },
  // Nagaland
  { id: "SEG0162", name: "NH-29 Kohima-Dimapur Sinking Zone", road_name: "NH-29", state: "Nagaland", district: "Kohima", lat: 25.7500, lon: 93.8800, risk_probability: 0.82, risk_percentage: "82%", status: "blocked", slope_degrees: 42.0, distance_to_river_km: 1.5, past_landslides: 9, rainfall_mm: 85 },
  // Arunachal Pradesh
  { id: "SEG0027", name: "Bomdila-Tawang Pass Rockfall Cutting", road_name: "Trans-Arunachal Hwy", state: "Arunachal Pradesh", district: "Tawang", lat: 27.4119, lon: 92.2605, risk_probability: 0.85, risk_percentage: "85%", status: "blocked", slope_degrees: 42.4, distance_to_river_km: 2.5, past_landslides: 7, rainfall_mm: 98 },
  // Mizoram
  { id: "SEG0175", name: "Aizawl-Lunglei Ridge Highway", road_name: "NH-54", state: "Mizoram", district: "Aizawl", lat: 23.4500, lon: 92.7500, risk_probability: 0.42, risk_percentage: "42%", status: "caution", slope_degrees: 28.0, distance_to_river_km: 4.0, past_landslides: 3, rainfall_mm: 55 },
];

export default function LiveMap({
  className = "",
  routePoints = [],
  altRoutePoints = [],
  hazardPoints = [],
  routeType = "safest",
  onSelectRouteType,
  mapMode = "2D",
}: LiveMapProps) {
  const { liveVehicles, liveAlerts } = useSimulation();
  const { t } = useI18n();
  const [apiSegments, setApiSegments] = useState<BackendSegment[]>([]);

  // Load real road segments from backend database
  useEffect(() => {
    api.getSegments().then((data) => {
      if (data?.segments && data.segments.length > 0) {
        setApiSegments(data.segments);
      }
    });
  }, []);

  // Merge API segments with fallback segments to ensure red dots are ALWAYS visible across all states
  const allSegments = apiSegments.length > 0 ? apiSegments : FALLBACK_SEGMENTS;

  // Separate segments by status so blocked (RED) and caution (AMBER) segments always render prominently
  const blockedSegments = allSegments.filter((s) => s.status === "blocked" || s.risk_probability >= 0.50);
  const cautionSegments = allSegments.filter((s) => (s.status === "caution" || s.risk_probability >= 0.35) && s.status !== "blocked" && s.risk_probability < 0.50);
  const openSegments = allSegments.filter((s) => s.status === "open" && s.risk_probability < 0.35);

  const startPoint = routePoints.length > 0 ? routePoints[0] : null;
  const endPoint = routePoints.length > 0 ? routePoints[routePoints.length - 1] : null;

  const currentTiles = TILE_LAYERS[mapMode] || TILE_LAYERS["2D"];

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[25.2, 93.5]}
        zoom={7}
        minZoom={5}
        scrollWheelZoom
        zoomControl={true}
        className={`h-full w-full ${className}`}
      >
        <TileLayer
          key={mapMode}
          url={currentTiles.url}
          attribution={currentTiles.attribution}
          maxZoom={currentTiles.maxZoom}
        />

        {/* Auto-frame bounds when directions change */}
        {routePoints.length > 1 && <MapBoundsUpdater points={routePoints} />}

        {/* 1. Open Road Segments (Green dots) */}
        {openSegments.slice(0, 100).map((s) => (
          <CircleMarker
            key={`open-${s.id}`}
            center={[s.lat, s.lon]}
            radius={4}
            pathOptions={{
              color: "#10B981",
              fillColor: "#10B981",
              fillOpacity: 0.65,
              weight: 1.5,
            }}
          >
            <Tooltip>
              🟢 {s.name} · {s.road_name} ({s.risk_percentage} {t("Risk")}) — {t("Open")}
            </Tooltip>
            <Popup>
              <div className="text-xs">
                <strong className="text-sm font-semibold text-emerald-600">{s.name}</strong>
                <p className="text-muted-foreground">{s.road_name} · {s.district}, {s.state}</p>
                <div className="mt-2 space-y-1">
                  <p><strong>{t("Status")}:</strong> <span className="text-emerald-600 font-bold">{t("OPEN / SAFE")}</span></p>
                  <p><strong>{t("ML Risk")}:</strong> {s.risk_percentage}</p>
                  <p><strong>{t("Slope")}:</strong> {s.slope_degrees}°</p>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* 2. Caution Road Segments (Amber/Yellow dots) */}
        {cautionSegments.slice(0, 80).map((s) => (
          <CircleMarker
            key={`caut-${s.id}`}
            center={[s.lat, s.lon]}
            radius={6}
            pathOptions={{
              color: "#F59E0B",
              fillColor: "#F59E0B",
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Tooltip>
              🟡 {s.name} · {s.road_name} ({s.risk_percentage} {t("Risk")}) — {t("Caution")}
            </Tooltip>
            <Popup>
              <div className="text-xs">
                <strong className="text-sm font-semibold text-amber-600">{s.name}</strong>
                <p className="text-muted-foreground">{s.road_name} · {s.district}, {s.state}</p>
                <div className="mt-2 space-y-1">
                  <p><strong>{t("Status")}:</strong> <span className="text-amber-600 font-bold">{t("CAUTION")}</span></p>
                  <p><strong>{t("ML Risk")}:</strong> {s.risk_percentage}</p>
                  <p><strong>{t("Slope")}:</strong> {s.slope_degrees}°</p>
                  <p><strong>{t("Rainfall")}:</strong> {s.rainfall_mm} mm</p>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* 3. Blocked Road Segments — PROMINENT RED DOTS with pulsing danger halos */}
        {blockedSegments.map((s) => (
          <div key={`block-group-${s.id}`}>
            {/* Outer danger halo ring */}
            <CircleMarker
              center={[s.lat, s.lon]}
              radius={14}
              pathOptions={{
                color: "#EF4444",
                fillColor: "#EF4444",
                fillOpacity: 0.25,
                weight: 1.5,
              }}
            />
            {/* Inner solid red dot */}
            <CircleMarker
              center={[s.lat, s.lon]}
              radius={8}
              pathOptions={{
                color: "#FFFFFF",
                fillColor: "#DC2626",
                fillOpacity: 1,
                weight: 2.5,
              }}
            >
              <Tooltip sticky>
                ⛔ <strong>{t("ROAD BLOCKED")}</strong>: {s.name} ({s.risk_percentage} {t("Risk")})
              </Tooltip>
              <Popup>
                <div className="text-xs">
                  <div className="flex items-center gap-1 text-red-600 font-bold text-sm">
                    <span>⛔</span>
                    <span>{t("ROAD BLOCKED")}</span>
                  </div>
                  <strong className="text-xs font-semibold text-foreground mt-1 block">{s.name}</strong>
                  <p className="text-muted-foreground">{s.road_name} · {s.district}, {s.state}</p>
                  <div className="mt-2 space-y-1 rounded bg-red-500/10 p-2 border border-red-500/20">
                    <p><strong>{t("Status")}:</strong> <span className="text-red-600 font-bold uppercase">{t("IMPASSABLE / BLOCKED")}</span></p>
                    <p><strong>{t("ML Risk")}:</strong> <span className="text-red-600 font-bold">{s.risk_percentage}</span></p>
                    <p><strong>{t("Terrain Slope")}:</strong> {s.slope_degrees}° (High Landslide Gradient)</p>
                    <p><strong>{t("River Proximity")}:</strong> {s.distance_to_river_km} km</p>
                    <p><strong>{t("Rainfall")}:</strong> {s.rainfall_mm} mm</p>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          </div>
        ))}

        {/* 4. Real-Time Critical & Warning Alerts — RED DANGER BEACONS */}
        {liveAlerts.filter((a) => a.level === "critical" || a.level === "warning").map((a) => {
          const dist = districts.find((d) => d.id === a.districtId);
          const lat = a.lat || (dist ? dist.lat + 0.03 : null);
          const lon = a.lon || (dist ? dist.lng + 0.03 : null);
          if (!lat || !lon) return null;
          const isCrit = a.level === "critical";

          return (
            <div key={`alert-marker-${a.id}`}>
              {/* Outer beacon halo */}
              <CircleMarker
                center={[lat, lon]}
                radius={isCrit ? 18 : 13}
                pathOptions={{
                  color: isCrit ? "#DC2626" : "#F59E0B",
                  fillColor: isCrit ? "#DC2626" : "#F59E0B",
                  fillOpacity: 0.28,
                  weight: 1.5,
                }}
              />
              {/* Inner beacon dot */}
              <CircleMarker
                center={[lat, lon]}
                radius={isCrit ? 8.5 : 6}
                pathOptions={{
                  color: "#FFFFFF",
                  fillColor: isCrit ? "#DC2626" : "#F59E0B",
                  fillOpacity: 1,
                  weight: 2.5,
                }}
              >
                <Tooltip sticky>
                  {isCrit ? "🚨" : "⚠️"} {a.title} ({t(a.category)})
                </Tooltip>
                <Popup>
                  <div className="text-xs">
                    <span className={`font-bold uppercase text-xs ${isCrit ? "text-red-600" : "text-amber-600"}`}>
                      {isCrit ? "🚨 CRITICAL INCIDENT" : "⚠️ WARNING"} · {t(a.category)}
                    </span>
                    <h4 className="font-semibold text-sm mt-1">{a.title}</h4>
                    <p className="text-muted-foreground mt-1">{a.message}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground border-t pt-1">
                      <span>{t("Channel")}: {a.channel}</span>
                      <span>{new Date(a.issuedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            </div>
          );
        })}

        {/* 5. Alternate Route (Dashed Polyline: Red/Amber if direct, Green if safest) */}
        {altRoutePoints.length > 1 && (
          <Polyline
            positions={altRoutePoints}
            pathOptions={{
              color: routeType === "safest" ? "#EF4444" : "#10B981",
              weight: 5,
              dashArray: "7 7",
              opacity: 0.85,
            }}
            eventHandlers={{
              click: () => onSelectRouteType?.(routeType === "safest" ? "shortest" : "safest"),
            }}
          >
            <Tooltip sticky>
              {routeType === "safest"
                ? `⚡ ${t("Shortest Route (Direct — High Risk with Hazard Points)")}`
                : `🛡️ ${t("Safest Route (ML Recommended Detour)")}`}
            </Tooltip>
          </Polyline>
        )}

        {/* 6. Active Selected Route (Solid Polyline: Green if safest, Red if direct/risky) */}
        {routePoints.length > 1 && (
          <Polyline
            positions={routePoints}
            pathOptions={{
              color: routeType === "safest" ? "#10B981" : "#EF4444",
              weight: 6,
              opacity: 0.95,
            }}
          >
            <Tooltip sticky>
              {routeType === "safest"
                ? `🛡️ ${t("Safest Route (ML Recommended — Bypasses Hazards)")}`
                : `⚡ ${t("Shortest Route (Direct — High Risk Corridor)")}`}
            </Tooltip>
          </Polyline>
        )}

        {/* 7. Route Origin Marker (Green Pin) */}
        {startPoint && (
          <CircleMarker
            center={startPoint}
            radius={8.5}
            pathOptions={{
              color: "#FFFFFF",
              fillColor: "#10B981",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -10]}>
              📍 {t("Origin")}
            </Tooltip>
          </CircleMarker>
        )}

        {/* 8. Route Destination Marker (Red Flag Pin) */}
        {endPoint && (
          <CircleMarker
            center={endPoint}
            radius={9.5}
            pathOptions={{
              color: "#FFFFFF",
              fillColor: "#DC2626",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -10]}>
              🏁 {t("Destination")}
            </Tooltip>
          </CircleMarker>
        )}

        {/* 9. Real Hazard & Danger Points Along the Corridor — RED DANGER DOTS */}
        {hazardPoints.map((h, i) => (
          <div key={h.id || `haz-grp-${i}`}>
            {/* Outer Pulsing Halo */}
            <CircleMarker
              center={[h.lat, h.lon]}
              radius={17}
              pathOptions={{
                color: "#DC2626",
                fillColor: "#DC2626",
                fillOpacity: 0.35,
                weight: 1.5,
              }}
            />
            {/* Inner Red Danger Dot */}
            <CircleMarker
              center={[h.lat, h.lon]}
              radius={9}
              pathOptions={{
                color: "#FFFFFF",
                fillColor: "#DC2626",
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Tooltip sticky>
                ⚠️ <strong>{t("CRITICAL HAZARD")}</strong>: {t(h.type)} ({t(h.risk_level)})
              </Tooltip>
              <Popup>
                <div className="text-xs">
                  <div className="flex items-center gap-1.5 text-red-600 font-bold text-sm">
                    <span>⚠️</span>
                    <span>{t("Critical Hazard Point")}</span>
                  </div>
                  <strong className="text-xs font-semibold text-foreground mt-1 block">{t(h.type)}</strong>
                  <p className="mt-1 text-muted-foreground">{t(h.description)}</p>
                  <div className="mt-2 space-y-1 rounded bg-red-500/10 p-2 border border-red-500/20">
                    {h.road && <p><strong>{t("Corridor")}:</strong> {h.road}</p>}
                    {h.slope_degrees && <p><strong>{t("Slope Gradient")}:</strong> {h.slope_degrees}°</p>}
                    {h.delay_min && <p><strong>{t("Expected Delay")}:</strong> +{h.delay_min} min</p>}
                    <p className="text-red-500 font-bold">{t("Severity")}: {t(h.risk_level)}</p>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          </div>
        ))}

        {/* 10. District Hubs */}
        {districts.map((d) => (
          <CircleMarker
            key={d.id}
            center={[d.lat, d.lng]}
            radius={d.risk === "critical" ? 10 : 7}
            pathOptions={{
              color: riskColor[d.risk] || "#3B82F6",
              fillColor: riskColor[d.risk] || "#3B82F6",
              fillOpacity: 0.25,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-xs">
                <strong>{d.name}</strong>, {d.state}
                <br />
                {t("Accessibility status")}: <strong>{t(d.risk.toUpperCase())}</strong>
                <br />
                {t("Population")}: {d.population.toLocaleString()}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* 11. Logistics & Emergency Vehicles */}
        {liveVehicles.map((v) => (
          <CircleMarker
            key={v.id}
            center={[v.lat, v.lng]}
            radius={6}
            pathOptions={{
              color: "#FFFFFF",
              fillColor: "#2563EB",
              fillOpacity: 1,
              weight: 2.5,
            }}
          >
            <Tooltip>
              🚚 {v.callSign} · {t(v.status)} · {v.speed} km/h
            </Tooltip>
            <Popup>
              <div className="text-xs">
                <strong className="text-sm font-semibold">{v.callSign}</strong>
                <p className="text-muted-foreground">{t(v.type)}</p>
                <div className="mt-2 space-y-0.5">
                  <p><strong>{t("Cargo")}:</strong> {t(v.cargo)}</p>
                  <p><strong>{t("Destination")}:</strong> {v.destination}</p>
                  <p><strong>{t("Speed")}:</strong> {v.speed} km/h | <strong>{t("Fuel")}:</strong> {v.fuel}%</p>
                  <p><strong>{t("ETA")}:</strong> {v.eta}</p>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Floating Map Legend */}
      <div className="absolute bottom-4 left-4 z-[400] rounded-xl border border-border/70 bg-background/90 p-2.5 shadow-lg backdrop-blur-md text-[11px] space-y-1.5 pointer-events-auto">
        <div className="font-semibold text-foreground text-xs flex items-center gap-1.5 pb-1 border-b border-border/50">
          <span className="inline-block size-2 rounded-full bg-red-500 animate-ping" />
          <span>{t("Live Map Status")}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-red-600 ring-2 ring-red-400" />
          <span className="text-foreground font-medium">{t("Blocked Road / Hazard Point")}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-amber-500" />
          <span className="text-muted-foreground">{t("Caution / High Slope Risk")}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-emerald-500" />
          <span className="text-muted-foreground">{t("Open Safe Corridor")}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-blue-600" />
          <span className="text-muted-foreground">{t("Active Transit Fleet")}</span>
        </div>
      </div>
    </div>
  );
}