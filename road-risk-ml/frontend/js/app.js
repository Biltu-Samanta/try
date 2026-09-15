/**
 * app.js — ManipurRiskAI SPA Entry Point
 * Manages screen routing, global state, and initialisation.
 */

import { fetchAPI, postAPI } from "./utils/api.js";
import { showToast, startSSEStream, initNotifications, setNotificationsEnabled, notificationsEnabled } from "./utils/notifications.js";
import { getIcon, SVG_ICONS } from "./utils/icons.js";

// ── Screen Registry ───────────────────────────────────────────
const SCREENS = {
  dashboard: { title: "Dashboard",        subtitle: "Mission Control" },
  map:       { title: "GIS Map",          subtitle: "Interactive Road Risk Map" },
  routes:    { title: "Route Planning",   subtitle: "Safe Route Recommendation Engine" },
  vehicles:  { title: "Vehicle Tracking", subtitle: "Live Fleet Management" },
  alerts:    { title: "Alerts",           subtitle: "Real-time Notifications" },
  reports:   { title: "Field Reports",    subtitle: "Geo-tagged Incident Reporting" },
  analytics: { title: "Analytics",        subtitle: "Bottleneck & Risk Intelligence" },
};

let currentScreen = "dashboard";
let currentState  = "all";   // currently selected NE state filter
let globalSegments = [];
let globalAlerts   = [];
let vehicleInterval = null;

// ── NE State map centers & zoom ───────────────────────────────
const NE_STATE_META = {
  "all":                  { center: [25.5, 92.5], zoom: 7 },
  "Arunachal Pradesh":    { center: [27.50, 93.61], zoom: 7 },
  "Assam":                { center: [26.20, 92.50], zoom: 7 },
  "Manipur":              { center: [24.66, 93.90], zoom: 8 },
  "Meghalaya":            { center: [25.57, 91.36], zoom: 8 },
  "Mizoram":              { center: [23.16, 92.95], zoom: 8 },
  "Nagaland":             { center: [26.16, 94.56], zoom: 8 },
  "Tripura":              { center: [23.94, 91.99], zoom: 8 },
  "Sikkim":               { center: [27.53, 88.51], zoom: 9 },
};

// ── Map instances (single maps reused) ───────────────────────
let miniMap       = null;
let mainMap       = null;
let routeMap      = null;
let vehiclesMap   = null;
let reportsMap    = null;
let emergencyMap  = null;

// ── Map layer groups ──────────────────────────────────────────
let roadLayer       = null;
let vehicleMarkers  = null;
let reportMarkers   = null;
let heatLayer       = null;

// ── Colour helpers ────────────────────────────────────────────
// 5-tier risk colour based on category string (as returned by /api/segments)
function riskCategoryColor(cat) {
  switch ((cat || "").toLowerCase()) {
    case "critical": return "#B71C1C"; // deep crimson
    case "high":     return "#E53935"; // red
    case "moderate": return "#F57C00"; // orange
    case "low":      return "#43A047"; // green
    default:         return "#43A047"; // fallback green
  }
}

// Legacy helper used by route-risk comparison table (keeps numeric-threshold logic)
function riskColor(prob) {
  if (prob >= 0.75) return "#B71C1C"; // critical
  if (prob >= 0.5)  return "#E53935"; // high
  if (prob >= 0.3)  return "#F57C00"; // moderate
  return "#43A047";                   // low / safe
}

function severityColor(sev) {
  return { critical: "#E53935", high: "#F57C00", medium: "#F7C948", info: "#1E88E5" }[sev] || "#888";
}

function badgeClass(sev) {
  return { critical: "badge-danger", high: "badge-warning", medium: "badge-warning", info: "badge-info" }[sev] || "badge-neutral";
}

// ─────────────────────────────────────────────────────────────
// ROUTING
// ─────────────────────────────────────────────────────────────
window.navigate = function (screen) {
  if (!SCREENS[screen]) return;

  // Hide all screens
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item[data-screen]").forEach(n => n.classList.remove("active"));

  // Show target screen
  document.getElementById(`screen-${screen}`)?.classList.add("active");
  document.getElementById(`nav-${screen}`)?.classList.add("active");

  // Update topbar if elements exist
  const tTitle = document.getElementById("topbar-title");
  if (tTitle && SCREENS[screen]) tTitle.textContent = SCREENS[screen].title;
  const tSub = document.getElementById("topbar-subtitle");
  if (tSub && SCREENS[screen]) tSub.textContent = SCREENS[screen].subtitle;

  currentScreen = screen;

  // Screen-specific init (lazy)
  if (screen === "map" && !mainMap) initMainMap();
  if (screen === "routes" && !routeMap) initRouteMap();
  if (screen === "vehicles") initVehiclesScreen();
  if (screen === "alerts") initAlertsScreen();
  if (screen === "reports") initReportsScreen();
  if (screen === "analytics") initAnalytics();

  // Leaflet maps compute size when the container is visible.
  // If the map already existed but was hidden, invalidate so it
  // recalculates viewport dimensions and prevents route clipping.
  setTimeout(() => {
    if (screen === "map" && mainMap)     mainMap.invalidateSize();
    if (screen === "routes" && routeMap) routeMap.invalidateSize();
    if (screen === "vehicles" && vehiclesMap) vehiclesMap.invalidateSize();
    if (screen === "reports" && reportsMap)   reportsMap.invalidateSize();
  }, 50);
};

// ─────────────────────────────────────────────────────────────
// INITIALISATION
// ─────────────────────────────────────────────────────────────
async function init() {
  try {
    setupSidebarToggle();
    startLiveClock();
    initNotifications();
    setupSearch();
    await checkAPIStatus();
    await loadSegments();
    await loadLocations(currentState);
    await initDashboard();
    initMiniMap();
    setupNavItems();
    startSSEStream(handleLiveAlert);
  } catch (err) {
    console.error("[INIT ERROR]", err);
  }
}

function setupNavItems() {
  document.querySelectorAll(".nav-item[data-screen]").forEach(btn => {
    btn.addEventListener("click", () => navigate(btn.dataset.screen));
  });
  const refBtn = document.getElementById("refresh-btn");
  if (refBtn) {
    refBtn.addEventListener("click", refreshAll);
  }
}

function setupSidebarToggle() {
  const toggleBtn = document.getElementById("sidebar-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const sidebar = document.getElementById("sidebar");
      if (sidebar) sidebar.classList.toggle("collapsed");
    });
  }
}

function startLiveClock() {
  const el = document.getElementById("live-time");
  function update() {
    const now = new Date();
    if (el) {
      el.textContent = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
  }
  if (el) {
    update();
    setInterval(update, 1000);
  }

  // Emergency clock
  setInterval(() => {
    const emEl = document.getElementById("emergency-time");
    if (emEl) emEl.textContent = new Date().toLocaleTimeString("en-IN");
  }, 1000);
}

async function checkAPIStatus() {
  const label = document.getElementById("api-status-label");
  try {
    const data = await fetchAPI("/status");
    label.textContent = `API Online · ML: ${data.ml_available ? "Active" : "Fallback"} · ${data.total_segments} segs`;
    // Silent on success — no toast spam
  } catch {
    label.textContent = "API Offline";
    showToast("API Offline", "Using cached data. Start Flask server.", "danger", 6000, true);
  }
}

async function loadSegments() {
  try {
    const qs   = currentState !== "all" ? `?state=${encodeURIComponent(currentState)}` : "";
    const data = await fetchAPI(`/segments${qs}`);
    globalSegments = data.segments || [];
  } catch {
    globalSegments = [];
  }
}

// ── State selector handler ─────────────────────────────────────
window.onStateChange = async function (state) {
  currentState = state;

  // Update dashboard label
  const label = document.getElementById("dashboard-region-label");
  if (label) label.textContent = state === "all"
    ? "Northeast India Road Risk Overview \u2014 Real-time intelligence"
    : `${state} Road Risk Overview \u2014 Real-time intelligence`;

  const alertsLabel = document.getElementById("alerts-region-label");
  if (alertsLabel) alertsLabel.textContent = state === "all"
    ? "Real-time road disruption alerts \u2014 Northeast India"
    : `Real-time road disruption alerts \u2014 ${state}`;

  // Re-center any visible maps
  const meta = NE_STATE_META[state] || NE_STATE_META["all"];
  if (miniMap)    miniMap.setView(meta.center, meta.zoom);
  if (mainMap)    mainMap.setView(meta.center, meta.zoom);
  if (routeMap)   routeMap.setView(meta.center, meta.zoom - 1);
  if (vehiclesMap) vehiclesMap.setView(meta.center, meta.zoom);

  // Reload data
  await loadSegments();
  await loadLocations(state);
  await initDashboard();
  if (currentScreen === "map" && mainMap) refreshMapLayers();
  // Silent state change — no toast on every state switch
};

window.refreshAll = async function () {
  await loadSegments();
  if (currentScreen === "dashboard") initDashboard();
  if (currentScreen === "map" && mainMap) refreshMapLayers();
  showToast("Data refreshed", "", "success", 2000);
};

// ── Mute/Unmute notifications toggle ─────────────────────────────
window.toggleMuteAlerts = function () {
  const nowEnabled = !notificationsEnabled;
  setNotificationsEnabled(nowEnabled);
  if (nowEnabled) {
    showToast("Notifications Unmuted", "You will now receive alerts.", "success", 2500);
  } else {
    showToast("Notifications Muted", "Alerts are silenced.", "default", 2500, true);
  }
};

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────
async function initDashboard() {
  try {
    await Promise.all([loadKPI(), loadDistricts(), loadAlertTicker()]);
  } catch (e) {
    console.error("Dashboard initial fetch failed:", e);
  }
  try {
    if (typeof renderStateRoadProblems === "function" && document.getElementById("dash-road-problems-list")) {
      renderStateRoadProblems();
    }
  } catch (e) {}
  try {
    if (typeof initDashboardSubDistrictOptions === "function" && document.getElementById("dash-sub-district-select")) {
      initDashboardSubDistrictOptions(currentState !== "all" ? currentState : "Manipur");
    }
  } catch (e) {}
}

async function loadKPI() {
  try {
    const qs   = currentState !== "all" ? `?state=${encodeURIComponent(currentState)}` : "";
    const data = await fetchAPI(`/kpi${qs}`);
    const grid = document.getElementById("kpi-grid");
    if (!grid) return;
    const kpis = [
      {
        icon: "🚨",
        label: "Active Alerts",
        value: data.total_active_alerts ?? 0,
        badgeText: "Live",
        badgeColor: "rgba(74, 222, 128, 0.15)",
        badgeTextColor: "#4ade80",
        sparkline: "M0,18 Q15,5 30,12 T60,4",
        sparkColor: "#4ade80"
      },
      {
        icon: "⛔",
        label: "Blocked Roads",
        value: data.blocked_roads ?? 0,
        badgeText: "Critical",
        badgeColor: "rgba(239, 68, 68, 0.18)",
        badgeTextColor: "#f87171",
        sparkline: "M0,10 Q20,19 40,8 T60,16",
        sparkColor: "#ef4444"
      },
      {
        icon: "🚛",
        label: "Vehicles in Transit",
        value: data.vehicles_in_transit ?? 0,
        badgeText: "Monitored",
        badgeColor: "rgba(74, 222, 128, 0.15)",
        badgeTextColor: "#4ade80",
        sparkline: "M0,16 Q15,4 35,14 T60,6",
        sparkColor: "#4ade80"
      },
      {
        icon: "⚠️",
        label: "Districts at Risk",
        value: data.districts_at_risk ?? 0,
        badgeText: "Advisory",
        badgeColor: "rgba(249, 115, 22, 0.18)",
        badgeTextColor: "#fb923c",
        sparkline: "M0,12 Q20,6 40,15 T60,10",
        sparkColor: "#f97316"
      },
      {
        icon: "✅",
        label: "Safe Routes",
        value: data.safe_routes_available ?? 0,
        badgeText: "Available",
        badgeColor: "rgba(74, 222, 128, 0.15)",
        badgeTextColor: "#4ade80",
        sparkline: "M0,14 Q20,18 40,8 T60,4",
        sparkColor: "#4ade80"
      },
      {
        icon: "🛑",
        label: "Critical Segments",
        value: data.critical_segments ?? 0,
        badgeText: "Action Required",
        badgeColor: "rgba(239, 68, 68, 0.18)",
        badgeTextColor: "#f87171",
        sparkline: "M0,8 Q20,18 40,6 T60,15",
        sparkColor: "#ef4444"
      },
    ];

    grid.innerHTML = kpis.map((k, i) => `
      <div class="glass-card kpi-card" style="animation:fadeInUp 0.4s ease ${i * 0.07}s both;background:rgba(12,28,18,0.72);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 14px;min-height:92px;display:flex;flex-direction:column;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-size:1.15rem;width:26px;display:flex;align-items:center;justify-content:center;">${k.icon}</div>
          <div class="kpi-value" style="font-size:1.6rem;font-weight:700;color:#ffffff;line-height:1;" data-target="${k.value}">0</div>
        </div>
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:4px;margin-top:6px;">
          <div>
            <div style="font-size:0.75rem;color:#8ea88a;font-weight:500;">${k.label}</div>
            <div style="display:inline-block;font-size:0.65rem;font-weight:600;color:${k.badgeTextColor};background:${k.badgeColor};padding:1px 6px;border-radius:10px;margin-top:2px;">${k.badgeText}</div>
          </div>
          <svg width="54" height="18" viewBox="0 0 60 20" style="overflow:visible;">
            <path d="${k.sparkline}" fill="none" stroke="${k.sparkColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    `).join("");

    // Animate count-up
    grid.querySelectorAll("[data-target]").forEach(el => {
      const target = parseInt(el.dataset.target) || 0;
      let current = 0;
      const step = Math.max(1, Math.ceil(target / 20));
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current;
        if (current >= target) clearInterval(timer);
      }, 40);
    });
  } catch (e) {
    console.error("KPI load failed", e);
  }
}

async function loadDistricts() {
  try {
    const qs   = currentState !== "all" ? `?state=${encodeURIComponent(currentState)}` : "";
    const data = await fetchAPI(`/districts${qs}`);
    const list = document.getElementById("district-list");
    if (!list || !data || !data.districts) return;
    list.innerHTML = data.districts.map(d => `
      <div class="district-item" onclick="filterMapByDistrict('${d.district}')" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;margin-bottom:6px;border-radius:8px;background:rgba(255,255,255,0.03);cursor:pointer;transition:all 0.2s;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="status-indicator ${d.status}" style="width:8px;height:8px;border-radius:50%;background:${d.status === 'blocked' ? '#ef4444' : (d.status === 'caution' ? '#f59e0b' : '#22c55e')};"></div>
          <div class="d-name" style="font-size:0.8rem;color:#e2fbe8;font-weight:500;">${d.district}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <div class="d-roads" style="font-size:0.72rem;color:#94b08d;">${d.blocked_roads} blocked</div>
          ${d.active_alerts > 0 ? `<div class="d-alerts" style="font-size:0.65rem;color:#f87171;background:rgba(239,68,68,0.15);padding:1px 5px;border-radius:6px;">${d.active_alerts} Alerts</div>` : ""}
        </div>
      </div>
    `).join("");
  } catch (e) {
    console.error("Districts load failed", e);
  }
}

async function loadAlertTicker() {
  try {
    const qs   = currentState !== "all" ? `?state=${encodeURIComponent(currentState)}` : "";
    const data = await fetchAPI(`/alerts${qs}`);
    globalAlerts = data.alerts || [];
    const badge = document.getElementById("alert-badge");
    if (badge) badge.textContent = globalAlerts.filter(a => a.severity === "critical").length;

    const ticker = document.getElementById("ticker-text");
    if (ticker && globalAlerts.length) {
      ticker.textContent = globalAlerts
        .slice(0, 6)
        .map(a => `[${(a.severity || "info").toUpperCase()}] ${a.title}: ${a.message.substring(0, 60)}…`)
        .join("   ·   ");
    }
  } catch (e) {}
}

function severityLabel(s) {
  return (s || "info").toUpperCase();
}

// ── FEATURE 1: DASHBOARD STATE ROAD PROBLEMS FILTER ─────────────
let dashSelectedState = "all";
let dashSelectedProblem = "all";

window.onDashRoadStateChange = function (state) {
  dashSelectedState = state;
  renderStateRoadProblems();
};

window.onDashRoadProblemChange = function (problem) {
  dashSelectedProblem = problem;
  renderStateRoadProblems();
};

export function renderStateRoadProblems() {
  const container = document.getElementById("dash-road-problems-list");
  const badge = document.getElementById("dash-problem-count-badge");
  if (!container) return;

  let segs = [...globalSegments];

  if (dashSelectedState !== "all") {
    segs = segs.filter(s => (s.state || "").toLowerCase() === dashSelectedState.toLowerCase());
  }

  if (dashSelectedProblem === "landslide") {
    segs = segs.filter(s => (s.past_landslide_count > 1 || s.slope_degrees > 28));
  } else if (dashSelectedProblem === "flood") {
    segs = segs.filter(s => (s.distance_to_river_km <= 2.0 && s.rainfall_mm > 35));
  } else if (dashSelectedProblem === "rain") {
    segs = segs.filter(s => (s.rainfall_mm > 40));
  } else if (dashSelectedProblem === "slope") {
    segs = segs.filter(s => (s.slope_degrees > 30));
  } else if (dashSelectedProblem === "blocked") {
    segs = segs.filter(s => (s.status === "blocked" || s.risk_probability >= 0.50));
  } else {
    segs = segs.filter(s => (
      s.risk_probability >= 0.35 ||
      s.status === "blocked" ||
      s.slope_degrees > 28 ||
      s.past_landslide_count > 1 ||
      s.rainfall_mm > 40
    ));
  }

  if (badge) {
    badge.textContent = `${segs.length} Roads Identified`;
  }

  if (segs.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1;padding:var(--gap-md);text-align:center;color:var(--text-muted);font-size:0.8rem;">
        No roads matching the selected criteria in this area.
      </div>
    `;
    return;
  }

  container.innerHTML = segs.slice(0, 40).map(s => {
    const tags = [];
    if (s.status === "blocked" || s.risk_probability >= 0.50) {
      tags.push(`<span class="problem-tag blocked">Blocked</span>`);
    }
    if (s.past_landslide_count > 1 || s.slope_degrees > 28) {
      tags.push(`<span class="problem-tag landslide">Landslide (${s.past_landslide_count} prior)</span>`);
    }
    if (s.distance_to_river_km <= 2.0 && s.rainfall_mm > 35) {
      tags.push(`<span class="problem-tag flood">River Proximity</span>`);
    }
    if (s.slope_degrees > 30) {
      tags.push(`<span class="problem-tag slope">Slope ${s.slope_degrees}°</span>`);
    }
    if (s.rainfall_mm > 40) {
      tags.push(`<span class="problem-tag flood">Rain ${s.rainfall_mm}mm</span>`);
    }
    if (tags.length === 0) {
      tags.push(`<span class="problem-tag" style="background:rgba(48,175,255,0.1);color:var(--c-light-cyan);border:1px solid var(--border-subtle);">Elevated Risk (${(s.risk_probability*100).toFixed(0)}%)</span>`);
    }

    return `
      <div class="road-problem-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
          <div>
            <div style="font-weight:700;font-size:0.82rem;color:var(--text-primary);">${s.road_name || s.name}</div>
            <div style="font-size:0.7rem;color:var(--text-secondary);">${s.district || "District"}, ${s.state} · ${s.type || "Highway"}</div>
          </div>
          <span style="font-size:0.75rem;font-weight:800;color:${s.risk_probability >= 0.5 ? 'var(--c-vibrant-blue)' : 'var(--c-light-cyan)'};background:rgba(48,175,255,0.08);padding:2px 6px;border-radius:4px;border:1px solid var(--border-subtle);">
            ${(s.risk_probability * 100).toFixed(0)}% Risk
          </span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:2px;">
          ${tags.join("")}
        </div>
      </div>
    `;
  }).join("");
}

// ── FEATURE 2: DISTRICT POOR / CRITICAL CONDITION INSPECTOR ─────
const STATE_DISTRICT_MAP = {
  "Manipur": ["Imphal West", "Imphal East", "Churachandpur", "Senapati", "Ukhrul", "Tamenglong", "Bishnupur", "Thoubal", "Chandel", "Kangpokpi"],
  "Arunachal Pradesh": ["Papum Pare", "Tawang", "East Siang", "West Kameng", "Lower Subansiri", "Changlang", "Lohit", "Namsai"],
  "Assam": ["Kamrup Metropolitan", "Cachar", "Dibrugarh", "Jorhat", "Nagaon", "Sonitpur", "Karbi Anglong", "Dima Hasao"],
  "Meghalaya": ["East Khasi Hills", "West Garo Hills", "Ri-Bhoi", "West Jaintia Hills", "West Khasi Hills", "South Garo Hills"],
  "Mizoram": ["Aizawl", "Lunglei", "Champhai", "Kolasib", "Serchhip", "Mamit", "Lawngtlai", "Siaha"],
  "Nagaland": ["Kohima", "Dimapur", "Mokokchung", "Tuensang", "Wokha", "Mon", "Phek", "Zunheboto"],
  "Tripura": ["West Tripura", "Dhalai", "North Tripura", "South Tripura", "Gomati", "Unakoti", "Khowai", "Sepahijala"],
  "Sikkim": ["East Sikkim", "West Sikkim", "North Sikkim", "South Sikkim", "Pakyong", "Soreng"]
};

window.onDashSubStateSelect = function(state) {
  initDashboardSubDistrictOptions(state);
};

export function initDashboardSubDistrictOptions(state = "Manipur") {
  const select = document.getElementById("dash-sub-district-select");
  if (!select) return;
  const dists = STATE_DISTRICT_MAP[state] || STATE_DISTRICT_MAP["Manipur"];
  select.innerHTML = `<option value="all">All Districts in ${state}</option>` +
    dists.map(d => `<option value="${d}">${d}</option>`).join("");
}

window.applyDistrictRoadFilter = function() {
  const state = document.getElementById("dash-sub-state-select")?.value || "Manipur";
  const district = document.getElementById("dash-sub-district-select")?.value || "all";
  const severity = document.getElementById("dash-sub-severity-select")?.value || "all";

  const wrap = document.getElementById("dash-district-results-wrap");
  const emptyPrompt = document.getElementById("dash-district-empty-prompt");
  const list = document.getElementById("dash-district-results-list");
  const summary = document.getElementById("dash-district-results-summary");

  if (!list || !wrap) return;

  let matches = globalSegments.filter(s => (s.state || "").toLowerCase() === state.toLowerCase());
  if (district !== "all") {
    matches = matches.filter(s => (s.district || "").toLowerCase() === district.toLowerCase());
  }

  if (severity === "critical") {
    matches = matches.filter(s => s.status === "blocked" || s.risk_category === "Critical" || s.risk_probability >= 0.65);
  } else if (severity === "high") {
    matches = matches.filter(s => (s.risk_category === "High" || (s.risk_probability >= 0.40 && s.risk_probability < 0.65)) && s.status !== "blocked");
  } else {
    matches = matches.filter(s => s.status === "blocked" || s.risk_category === "Critical" || s.risk_category === "High" || s.risk_probability >= 0.40);
  }

  if (emptyPrompt) emptyPrompt.style.display = "none";
  wrap.style.display = "block";

  if (summary) {
    const distLabel = district === "all" ? `all districts in ${state}` : `${district}, ${state}`;
    summary.textContent = `Found ${matches.length} road(s) in poor/critical condition in ${distLabel}`;
  }

  if (matches.length === 0) {
    list.innerHTML = `
      <div style="grid-column:1/-1;padding:var(--gap-md);text-align:center;color:var(--text-muted);font-size:0.8rem;background:var(--bg-card);border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
        No roads found in poor or critical condition for ${district === "all" ? state : district}. All monitored segments report safe transit.
      </div>
    `;
    return;
  }

  list.innerHTML = matches.map(s => {
    const isCritical = s.status === "blocked" || s.risk_probability >= 0.65;
    const condBadge = isCritical
      ? `<span style="background:rgba(48,175,255,0.25);color:var(--c-warm-cream);border:1px solid var(--c-vibrant-blue);font-size:0.68rem;padding:2px 6px;border-radius:4px;font-weight:700;">Critical Condition</span>`
      : `<span style="background:rgba(146,238,255,0.18);color:var(--c-light-cyan);border:1px solid var(--c-light-cyan);font-size:0.68rem;padding:2px 6px;border-radius:4px;font-weight:700;">Poor Condition</span>`;

    return `
      <div class="road-problem-card" style="border-left:3px solid ${isCritical ? 'var(--c-vibrant-blue)' : 'var(--c-light-cyan)'};">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
          <div>
            <div style="font-weight:700;font-size:0.82rem;color:var(--text-primary);">${s.road_name || s.name}</div>
            <div style="font-size:0.7rem;color:var(--text-secondary);">${s.district || "District"}, ${s.state} · Slope ${s.slope_degrees || 20}°</div>
          </div>
          ${condBadge}
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);display:flex;justify-content:space-between;margin-top:2px;">
          <span>Rain: ${s.rainfall_mm || 15}mm · Past Disruption: ${s.past_landslide_count || 0}</span>
          <span style="font-weight:700;color:var(--c-light-cyan);">${(s.risk_probability * 100).toFixed(0)}% Risk</span>
        </div>
      </div>
    `;
  }).join("");
};

window.resetDistrictRoadFilter = function() {
  const wrap = document.getElementById("dash-district-results-wrap");
  const emptyPrompt = document.getElementById("dash-district-empty-prompt");
  if (wrap) wrap.style.display = "none";
  if (emptyPrompt) emptyPrompt.style.display = "block";
};

// ─────────────────────────────────────────────────────────────
// MINI MAP (Dashboard preview)
// ─────────────────────────────────────────────────────────────
function initMiniMap() {
  const el = document.getElementById("mini-map");
  if (!el || miniMap) return;

  const meta = NE_STATE_META[currentState] || NE_STATE_META["all"];
  miniMap = L.map("mini-map", { zoomControl: false, attributionControl: false })
    .setView(meta.center, meta.zoom - 1);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
  }).addTo(miniMap);

  // NE India capital markers
  const capitals = [
    { name: "Imphal",   lat: 24.817, lon: 93.944 },
    { name: "Dispur",   lat: 26.145, lon: 91.736 },
    { name: "Shillong", lat: 25.578, lon: 91.893 },
    { name: "Kohima",   lat: 25.674, lon: 94.112 },
    { name: "Gangtok",  lat: 27.329, lon: 88.612 },
    { name: "Aizawl",   lat: 23.727, lon: 92.718 },
    { name: "Agartala", lat: 23.836, lon: 91.279 },
    { name: "Itanagar", lat: 27.101, lon: 93.619 },
  ];
  capitals.forEach(c =>
    L.circleMarker([c.lat, c.lon], { radius: 5, fillColor: "#FF6B00", color: "#FFF", weight: 2, fillOpacity: 0.9 })
      .bindTooltip(c.name, { permanent: false })
      .addTo(miniMap)
  );

  drawRoadsOnMap(miniMap, globalSegments);
}

// ── Map Tile Layer Switcher ────────────────────────────────────
const MAP_TILES = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri World Imagery",
    maxZoom: 18,
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap contributors",
    maxZoom: 17,
  },
};

let currentTileLayer = null;
let currentMapMode   = "osm";  // 'osm' | 'satellite' | 'terrain'
let is3DMode         = false;
let mapPitch         = 38;     // 3D tilt angle in degrees
let mapBearing       = 0;      // 3D rotation in degrees

window.setMapLayer = function (mode, preserve3D = true) {
  if (!mainMap) return;
  currentMapMode = mode;

  if (currentTileLayer) mainMap.removeLayer(currentTileLayer);
  const tile = MAP_TILES[mode] || MAP_TILES.osm;
  currentTileLayer = L.tileLayer(tile.url, {
    maxZoom: tile.maxZoom,
    attribution: tile.attribution,
  }).addTo(mainMap);

  // Update button active states
  ["osm", "satellite", "terrain"].forEach(m => {
    document.getElementById(`map-mode-${m}`)?.classList.toggle("active", m === mode);
  });

  // Exit 3D only if explicitly asked
  if (!preserve3D && is3DMode) {
    window.toggle3DMap(false);
  }
};

window.toggle3DMap = function (forceState) {
  if (!mainMap) return;
  is3DMode = typeof forceState === "boolean" ? forceState : !is3DMode;
  const mapEl = document.getElementById("main-map");
  const btn = document.getElementById("map-mode-3d");
  const hud = document.getElementById("map-3d-hud");

  if (is3DMode) {
    // 3D perspective via CSS transform
    mapEl.style.transform = `perspective(1000px) rotateX(${mapPitch}deg) rotateZ(${mapBearing}deg) scale(1.18)`;
    mapEl.style.transformOrigin = "center 45%";
    mapEl.style.transition = "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
    mapEl.classList.add("map-in-3d");
    if (btn) {
      btn.classList.add("active");
      btn.innerHTML = `🏔️ 3D Active <span class="active-dot"></span>`;
    }
    if (hud) hud.style.display = "flex";

    // Switch to terrain in 3D for mountain elevation feel
    if (currentMapMode === "osm") {
      window.setMapLayer("terrain", true);
    }
  } else {
    mapEl.style.transform = "none";
    mapEl.style.transition = "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
    mapEl.classList.remove("map-in-3d");
    if (btn) {
      btn.classList.remove("active");
      btn.innerHTML = `🏔️ 3D Mode`;
    }
    if (hud) hud.style.display = "none";
  }

  setTimeout(() => {
    if (mainMap) mainMap.invalidateSize();
  }, 520);
};

window.adjust3DPitch = function (deg) {
  mapPitch = Math.max(15, Math.min(65, deg));
  if (is3DMode) {
    const mapEl = document.getElementById("main-map");
    if (mapEl) {
      mapEl.style.transform = `perspective(1000px) rotateX(${mapPitch}deg) rotateZ(${mapBearing}deg) scale(1.18)`;
    }
    document.querySelectorAll(".pitch-btn").forEach(b => {
      b.classList.toggle("active", parseInt(b.dataset.pitch) === mapPitch);
    });
  }
};

window.adjust3DBearing = function (delta) {
  if (delta === 0) {
    mapBearing = 0;
  } else {
    mapBearing = (mapBearing + delta) % 360;
  }
  if (is3DMode) {
    const mapEl = document.getElementById("main-map");
    if (mapEl) {
      mapEl.style.transform = `perspective(1000px) rotateX(${mapPitch}deg) rotateZ(${mapBearing}deg) scale(1.18)`;
    }
    const compass = document.getElementById("compass-indicator");
    if (compass) compass.style.transform = `rotate(${-mapBearing}deg)`;
  }
};

let miniMapIs3D = false;
window.toggleMiniMap3D = function (forceState) {
  if (!miniMap) return;
  miniMapIs3D = typeof forceState === "boolean" ? forceState : !miniMapIs3D;
  const mapEl = document.getElementById("mini-map");
  const btn   = document.getElementById("mini-map-3d-btn");

  if (miniMapIs3D) {
    mapEl.style.transform      = "perspective(900px) rotateX(34deg) scale(1.15)";
    mapEl.style.transformOrigin = "center 40%";
    mapEl.style.transition      = "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
    if (btn) {
      btn.classList.add("btn-primary");
      btn.classList.remove("btn-secondary");
      btn.innerHTML = "🏔️ 3D Active";
    }
  } else {
    mapEl.style.transform  = "none";
    mapEl.style.transition = "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
    if (btn) {
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-secondary");
      btn.innerHTML = "🏔️ 3D View";
    }
  }
  setTimeout(() => { if (miniMap) miniMap.invalidateSize(); }, 520);
};

function initMainMap() {
  const el = document.getElementById("main-map");
  if (!el || mainMap) return;

  const meta = NE_STATE_META[currentState] || NE_STATE_META["all"];
  mainMap = L.map("main-map", { zoomControl: true })
    .setView(meta.center, meta.zoom);
  window.mainMap = mainMap;

  // Default OSM tile layer
  currentTileLayer = L.tileLayer(MAP_TILES.osm.url, {
    maxZoom: MAP_TILES.osm.maxZoom,
    attribution: MAP_TILES.osm.attribution,
  }).addTo(mainMap);

  roadLayer = L.layerGroup().addTo(mainMap);
  vehicleMarkers = L.markerClusterGroup({ maxClusterRadius: 30 });
  mainMap.addLayer(vehicleMarkers);

  drawRoadsOnMap(mainMap, globalSegments, roadLayer);
  setupLayerToggles(mainMap);
  addCapitalMarker(mainMap);

  // Auto-refresh roads every 60s
  setInterval(() => { if (currentScreen === "map") refreshMapLayers(); }, 60000);
}

function addCapitalMarker(map) {
  const icon = L.divIcon({
    html: `<div style="background:var(--c-vibrant-blue);border:2px solid var(--c-warm-cream);border-radius:50%;width:14px;height:14px;"></div>`,
    className: "",
    iconSize: [14, 14],
  });
  L.marker([24.817, 93.944], { icon })
    .bindPopup(`<div class="road-popup"><h4>Imphal — Capital City</h4><div class="popup-row"><span class="popup-label">District</span><span class="popup-val">Imphal West</span></div></div>`)
    .addTo(map);
}

function createHazardMarker(seg, type) {
  const probPoint = (seg.coords && seg.coords.length > 0)
    ? seg.coords[Math.floor(seg.coords.length / 2)]
    : [seg.lat, seg.lon];

  const isBlocked = type === "blocked";
  const iconHtml = `
    <div class="hazard-pulse-marker" title="${isBlocked ? 'Road Blocked Point' : 'Critical Hazard Point'}: ${seg.name}">
      <div class="hazard-pulse-ring ${isBlocked ? 'blocked' : 'critical'}"></div>
      <div class="hazard-icon-bubble ${isBlocked ? 'blocked' : 'critical'}" style="display:flex;align-items:center;justify-content:center;color:#060E1A;">
        ${isBlocked ? getIcon('blocked') : getIcon('warning')}
      </div>
    </div>
  `;

  const hazardIcon = L.divIcon({
    html: iconHtml,
    className: "hazard-marker-container",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });

  const marker = L.marker(probPoint, { icon: hazardIcon, zIndexOffset: 1000 });
  
  const statusBadge = isBlocked 
    ? `<span style="background:var(--c-vibrant-blue);color:#060E1A;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:700;">ROAD BLOCKED POINT</span>`
    : `<span style="background:var(--c-light-cyan);color:#060E1A;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:700;">CRITICAL HAZARD POINT</span>`;

  marker.bindPopup(`
    <div class="road-popup">
      <h4>${isBlocked ? 'Exact Blocked Location' : 'Exact Critical Hazard Location'}</h4>
      <div style="margin:4px 0 8px 0;">${statusBadge}</div>
      <div class="popup-row"><span class="popup-label">Segment</span><span class="popup-val">${seg.name}</span></div>
      <div class="popup-row"><span class="popup-label">Exact Point</span><span class="popup-val">${probPoint[0].toFixed(4)}, ${probPoint[1].toFixed(4)}</span></div>
      <div class="popup-row"><span class="popup-label">Road</span><span class="popup-val">${seg.road} (${seg.district})</span></div>
      <div class="popup-row"><span class="popup-label">Risk Score</span><span class="popup-val text-danger" style="font-weight:700;">${seg.risk_percentage}</span></div>
      <div class="popup-row"><span class="popup-label">Rainfall</span><span class="popup-val">${seg.rainfall_mm} mm</span></div>
      ${seg.delay_min > 0 ? `<div class="popup-row"><span class="popup-label">Est. Delay</span><span class="popup-val text-danger">+${seg.delay_min} min</span></div>` : ""}
      <div class="popup-row"><span class="popup-label">Status</span><span class="popup-val" style="color:var(--c-light-cyan);font-weight:600;">${isBlocked ? 'Road passage blocked here' : 'Critical hazard at this location'}</span></div>
      <div style="margin-top:8px;display:flex;gap:6px;">
        <button style="flex:1;padding:4px 8px;background:var(--c-vibrant-blue);color:#060E1A;border:none;border-radius:4px;cursor:pointer;font-size:0.72rem;font-weight:600;" onclick="window.planRouteTo('${seg.name}')">Plan Detour</button>
      </div>
    </div>
  `);

  return marker;
}

function drawRoadsOnMap(map, segments, layer = null) {
  if (!segments || !segments.length) return;

  segments.forEach(seg => {
    if (!seg.coords || seg.coords.length < 2) return;

    const isBlocked   = (seg.status || "").toLowerCase() === "blocked";
    const isCritical  = (seg.risk_category || "").toLowerCase() === "critical";

    if (isBlocked || isCritical) {
      const hazardMarker = createHazardMarker(seg, isBlocked ? "blocked" : "critical");
      if (layer) layer.addLayer(hazardMarker);
      else hazardMarker.addTo(map);
    }
  });
}

function buildRoadPopup(seg) {
  const isBlocked = (seg.status || "").toLowerCase() === "blocked";
  const color = isBlocked ? "var(--c-vibrant-blue)" : riskCategoryColor(seg.risk_category);
  const statusLabel = isBlocked ? `BLOCKED` : seg.status.toUpperCase();
  return `
    <div class="road-popup">
      <h4>${seg.name}</h4>
      <div class="popup-row"><span class="popup-label">Road</span><span class="popup-val">${seg.road}</span></div>
      <div class="popup-row"><span class="popup-label">Status</span><span class="popup-val" style="color:${color};font-weight:700;">${statusLabel}</span></div>
      <div class="popup-row"><span class="popup-label">Risk Score</span><span class="popup-val" style="color:${color};">${seg.risk_percentage}</span></div>
      <div class="popup-row"><span class="popup-label">Category</span><span class="popup-val" style="color:${color};font-weight:600;">${seg.risk_category}</span></div>
      <div class="popup-row"><span class="popup-label">District</span><span class="popup-val">${seg.district}</span></div>
      <div class="popup-row"><span class="popup-label">Last Updated</span><span class="popup-val">${seg.last_updated}</span></div>
      <div class="popup-row"><span class="popup-label">Rainfall Today</span><span class="popup-val">${seg.rainfall_mm} mm</span></div>
      <div class="popup-row"><span class="popup-label">Incidents (24h)</span><span class="popup-val">${seg.incidents_24h}</span></div>
      ${seg.delay_min > 0 ? `<div class="popup-row"><span class="popup-label">Est. Delay</span><span class="popup-val text-danger">+${seg.delay_min} min</span></div>` : ""}
      <div style="margin-top:8px;display:flex;gap:6px;">
        <button style="flex:1;padding:4px 8px;background:var(--peacock-teal);color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.72rem;" onclick="window.planRouteTo('${seg.name}')">Plan Route</button>
        ${seg.alternative_routes > 0 ? `<button style="padding:4px 8px;background:var(--saffron);color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.72rem;">${seg.alternative_routes} Alt</button>` : ""}
      </div>
    </div>`;
}

function setupLayerToggles(map) {
  const layers = [
    { id: "road-status", label: "Road Status", default: true },
    { id: "rainfall-heat", label: "Rainfall Heatmap", default: false },
    { id: "district-bounds", label: "District Boundaries", default: false },
    { id: "flood-zones", label: "Flood-prone Areas", default: false },
    { id: "landslide-zones", label: "Landslide-prone Areas", default: false },
    { id: "shelters", label: "Emergency Shelters", default: false },
    { id: "live-vehicles", label: "Live Vehicles", default: true },
  ];

  const container = document.getElementById("layer-toggles");
  if (!container) return;

  container.innerHTML = layers.map(l => `
    <div class="layer-toggle-row">
      <span>${l.label}</span>
      <label class="toggle-switch">
        <input type="checkbox" id="layer-${l.id}" ${l.default ? "checked" : ""} onchange="toggleLayer('${l.id}', this.checked)">
        <div class="toggle-track"></div><div class="toggle-thumb"></div>
      </label>
    </div>`).join("");
}

window.toggleLayer = function (layerId, visible) {
  // In a full implementation, each layer would be a Leaflet LayerGroup
  showToast(`Layer ${visible ? "enabled" : "disabled"}`, layerId.replace("-", " "), "default", 1500);
};

window.toggleLayersPanel = function () {
  const panel = document.getElementById("layers-panel");
  if (panel) panel.style.display = panel.style.display === "none" ? "block" : "none";
};

async function refreshMapLayers() {
  await loadSegments();
  if (roadLayer) { roadLayer.clearLayers(); drawRoadsOnMap(mainMap, globalSegments, roadLayer); }
}

window.applyMapFilters = function () {
  const district = document.getElementById("filter-district")?.value;
  const risk = document.getElementById("filter-risk")?.value;
  const status = document.getElementById("filter-status")?.value;

  let filtered = globalSegments;
  if (district) filtered = filtered.filter(s => s.district === district);
  if (status)   filtered = filtered.filter(s => (s.status || "").toLowerCase() === status.toLowerCase());
  // Filter by risk_category string (exact API value, case-insensitive)
  if (risk)     filtered = filtered.filter(s => (s.risk_category || "").toLowerCase() === risk.toLowerCase());

  if (roadLayer) { roadLayer.clearLayers(); drawRoadsOnMap(mainMap, filtered, roadLayer); }
  toggleLayersPanel();
  showToast(`Filter applied`, `${filtered.length} segments shown`, "default", 2000);
};


window.filterMapByDistrict = function (district) {
  navigate("map");
  setTimeout(() => {
    const sel = document.getElementById("filter-district");
    if (sel) { sel.value = district; applyMapFilters(); }
  }, 300);
};

window.planRouteTo = function (name) {
  navigate("routes");
  setTimeout(() => {
    const dest = document.getElementById("route-destination");
    if (dest) dest.value = name;
  }, 300);
};

// ─────────────────────────────────────────────────────────────
// ROUTE PLANNING & LOCATIONS
// ─────────────────────────────────────────────────────────────
const DEFAULT_NE_LOCATIONS = [
  { name: "Guwahati", state: "Assam", lat: 26.1445, lon: 91.7362 },
  { name: "Dispur", state: "Assam", lat: 26.1408, lon: 91.7900 },
  { name: "Silchar", state: "Assam", lat: 24.8333, lon: 92.7789 },
  { name: "Dibrugarh", state: "Assam", lat: 27.4728, lon: 94.9120 },
  { name: "Jorhat", state: "Assam", lat: 26.7509, lon: 94.2037 },
  { name: "Tezpur", state: "Assam", lat: 26.6338, lon: 92.7926 },
  { name: "Nagaon", state: "Assam", lat: 26.3465, lon: 92.6840 },
  { name: "Imphal", state: "Manipur", lat: 24.8170, lon: 93.9368 },
  { name: "Churachandpur", state: "Manipur", lat: 24.3330, lon: 93.6760 },
  { name: "Thoubal", state: "Manipur", lat: 24.6370, lon: 94.0040 },
  { name: "Bishnupur", state: "Manipur", lat: 24.6300, lon: 93.7600 },
  { name: "Senapati", state: "Manipur", lat: 25.2670, lon: 94.0170 },
  { name: "Ukhrul", state: "Manipur", lat: 25.1160, lon: 94.3620 },
  { name: "Tamenglong", state: "Manipur", lat: 24.9850, lon: 93.4930 },
  { name: "Kakching", state: "Manipur", lat: 24.4840, lon: 93.9800 },
  { name: "Mao", state: "Manipur", lat: 25.5080, lon: 94.1370 },
  { name: "Shillong", state: "Meghalaya", lat: 25.5788, lon: 91.8933 },
  { name: "Cherrapunji (Sohra)", state: "Meghalaya", lat: 25.2702, lon: 91.7323 },
  { name: "Tura", state: "Meghalaya", lat: 25.5142, lon: 90.2033 },
  { name: "Jowai", state: "Meghalaya", lat: 25.4455, lon: 92.2032 },
  { name: "Nongpoh", state: "Meghalaya", lat: 25.9016, lon: 91.8803 },
  { name: "Gangtok", state: "Sikkim", lat: 27.3389, lon: 88.6065 },
  { name: "Namchi", state: "Sikkim", lat: 27.1667, lon: 88.3500 },
  { name: "Gyalshing", state: "Sikkim", lat: 27.2833, lon: 88.2333 },
  { name: "Mangan", state: "Sikkim", lat: 27.5167, lon: 88.5333 },
  { name: "Kohima", state: "Nagaland", lat: 25.6751, lon: 94.1086 },
  { name: "Dimapur", state: "Nagaland", lat: 25.9068, lon: 93.7271 },
  { name: "Mokokchung", state: "Nagaland", lat: 26.3262, lon: 94.5244 },
  { name: "Tuensang", state: "Nagaland", lat: 26.2825, lon: 94.8286 },
  { name: "Aizawl", state: "Mizoram", lat: 23.7271, lon: 92.7176 },
  { name: "Lunglei", state: "Mizoram", lat: 22.8872, lon: 92.7402 },
  { name: "Champhai", state: "Mizoram", lat: 23.4754, lon: 93.3283 },
  { name: "Serchhip", state: "Mizoram", lat: 23.3417, lon: 92.8500 },
  { name: "Itanagar", state: "Arunachal Pradesh", lat: 27.0844, lon: 93.6053 },
  { name: "Naharlagun", state: "Arunachal Pradesh", lat: 27.1080, lon: 93.6930 },
  { name: "Tawang", state: "Arunachal Pradesh", lat: 27.5861, lon: 91.8594 },
  { name: "Pasighat", state: "Arunachal Pradesh", lat: 28.0667, lon: 95.3333 },
  { name: "Ziro", state: "Arunachal Pradesh", lat: 27.5594, lon: 93.8385 },
  { name: "Agartala", state: "Tripura", lat: 23.8315, lon: 91.2868 },
  { name: "Udaipur", state: "Tripura", lat: 23.5333, lon: 91.4833 },
  { name: "Dharmanagar", state: "Tripura", lat: 24.3667, lon: 92.1667 },
  { name: "Kailashahar", state: "Tripura", lat: 24.3333, lon: 92.0000 }
];

let cachedLocations     = [...DEFAULT_NE_LOCATIONS];
let routeShortestLine   = null;
let routeSafeLine       = null;
let routeOriginMarker   = null;
let routeDestMarker     = null;
let routeRoadLayer      = null;   // road-risk segments drawn on the route map
let routeData           = null;   // last API response — kept for selectRoute()
let routeOriginData     = null;
let routeDestData       = null;
let activeRouteKey      = null;   // 'shortest' | 'recommended'
let routeHazardMarkers  = [];
let routeCurrentTileLayer = null; // current tile layer on route map
let routeCurrentMapMode   = "osm";
let routeIs3D             = false;
let searchPinMarker       = null;

// ─────────────────────────────────────────────────────────────
// SEARCH ENGINE: TOPBAR & GIS MAP LIVE SEARCH
// ─────────────────────────────────────────────────────────────
function highlightMapSegment(seg) {
  if (!mainMap) initMainMap();
  const targetCoords = (seg.coords && seg.coords.length > 0)
    ? seg.coords[Math.floor(seg.coords.length / 2)]
    : [seg.lat, seg.lon];

  mainMap.setView(targetCoords, 13);

  if (searchPinMarker) {
    mainMap.removeLayer(searchPinMarker);
    searchPinMarker = null;
  }

  const pinHtml = `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:38px;height:38px;border-radius:50%;background:rgba(31,234,0,0.35);animation:pulse-ring 1.2s infinite;"></div>
      <div style="width:26px;height:26px;border-radius:50%;background:#1fea00;border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;color:#031408;box-shadow:0 0 12px #1fea00;font-size:12px;">
        📍
      </div>
    </div>
  `;
  const pinIcon = L.divIcon({
    html: pinHtml,
    className: "",
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });

  searchPinMarker = L.marker(targetCoords, { icon: pinIcon, zIndexOffset: 2000 })
    .addTo(mainMap)
    .bindPopup(`
      <div class="road-popup">
        <h4>${seg.road_name || seg.name}</h4>
        <div class="popup-row"><span class="popup-label">District</span><span class="popup-val">${seg.district || "N/A"}, ${seg.state || ""}</span></div>
        <div class="popup-row"><span class="popup-label">Road</span><span class="popup-val">${seg.road || "Highway"}</span></div>
        <div class="popup-row"><span class="popup-label">Status</span><span class="popup-val">${seg.status || "open"}</span></div>
        <div class="popup-row"><span class="popup-label">Risk</span><span class="popup-val text-danger">${seg.risk_percentage || ((seg.risk_probability || 0.2) * 100).toFixed(0) + '%'}</span></div>
        <div style="margin-top:8px;display:flex;gap:6px;">
          <button style="flex:1;padding:5px 10px;background:#1fea00;color:#031408;border:none;border-radius:6px;cursor:pointer;font-size:0.75rem;font-weight:700;" onclick="window.planRouteTo('${seg.road_name || seg.name}')">Plan Route Here</button>
        </div>
      </div>
    `)
    .openPopup();
}

function highlightMapLocation(loc) {
  if (!mainMap) initMainMap();
  mainMap.setView([loc.lat, loc.lon], 12);

  if (searchPinMarker) {
    mainMap.removeLayer(searchPinMarker);
  }

  const pinIcon = L.divIcon({
    html: `<div style="background:#30AFFF;border:2px solid #fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px #30AFFF;color:#fff;font-size:11px;">📍</div>`,
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  searchPinMarker = L.marker([loc.lat, loc.lon], { icon: pinIcon, zIndexOffset: 2000 })
    .addTo(mainMap)
    .bindPopup(`<div class="road-popup"><h4>${loc.name}</h4><div class="popup-row"><span class="popup-label">State</span><span class="popup-val">${loc.state || "NE India"}</span></div><div style="margin-top:8px;"><button style="width:100%;padding:5px 10px;background:#30AFFF;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.75rem;font-weight:700;" onclick="window.planRouteTo('${loc.name}')">Plan Route To Here</button></div></div>`)
    .openPopup();
}

function renderTopbarSearchResults(query) {
  const dropdown = document.getElementById("topbar-search-dropdown");
  if (!dropdown) return;

  const q = query.toLowerCase();

  const matchedPlaces = cachedLocations.filter(l => 
    l.name.toLowerCase().includes(q) || (l.state && l.state.toLowerCase().includes(q))
  ).slice(0, 4);

  const matchedSegments = (globalSegments || []).filter(s =>
    (s.name && s.name.toLowerCase().includes(q)) ||
    (s.road && s.road.toLowerCase().includes(q)) ||
    (s.road_name && s.road_name.toLowerCase().includes(q)) ||
    (s.district && s.district.toLowerCase().includes(q))
  ).slice(0, 4);

  const matchedAlerts = (allAlerts || globalAlerts || []).filter(a =>
    (a.title && a.title.toLowerCase().includes(q)) ||
    (a.road && a.road.toLowerCase().includes(q)) ||
    (a.district && a.district.toLowerCase().includes(q)) ||
    (a.type && a.type.toLowerCase().includes(q))
  ).slice(0, 3);

  const hasAny = matchedPlaces.length > 0 || matchedSegments.length > 0 || matchedAlerts.length > 0;

  if (!hasAny) {
    dropdown.innerHTML = `
      <div class="search-empty-state">
        No matches found for &ldquo;${query}&rdquo;.<br>
        <small style="color:#a8c4a4;">Press Enter to search GIS map or coordinates.</small>
      </div>
    `;
    dropdown.classList.add("active");
    return;
  }

  let html = "";

  if (matchedPlaces.length > 0) {
    html += `<div class="search-group-title">📍 Cities & Locations</div>`;
    matchedPlaces.forEach(p => {
      html += `
        <div class="search-result-row" data-type="place" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${p.name}">
          <div class="search-result-icon">🏙️</div>
          <div class="search-result-content">
            <div class="search-result-main">${p.name}</div>
            <div class="search-result-sub">${p.state || "Northeast India"}</div>
          </div>
          <span class="search-result-badge safe">City</span>
        </div>
      `;
    });
  }

  if (matchedSegments.length > 0) {
    html += `<div class="search-group-title">🛣️ Monitored Roads</div>`;
    matchedSegments.forEach(s => {
      const isBlocked = (s.status || "").toLowerCase() === "blocked";
      const isCrit = (s.risk_category || "").toLowerCase() === "critical";
      const badgeCls = isBlocked ? "critical" : isCrit ? "high" : "safe";
      const badgeTxt = isBlocked ? "Blocked" : isCrit ? "Critical" : "Open";
      html += `
        <div class="search-result-row" data-type="segment" data-id="${s.id || ''}">
          <div class="search-result-icon">${isBlocked ? '⛔' : '🛣️'}</div>
          <div class="search-result-content">
            <div class="search-result-main">${s.road_name || s.name}</div>
            <div class="search-result-sub">${s.road || ''} · ${s.district || ''}, ${s.state || ''}</div>
          </div>
          <span class="search-result-badge ${badgeCls}">${badgeTxt}</span>
        </div>
      `;
    });
  }

  if (matchedAlerts.length > 0) {
    html += `<div class="search-group-title">🔔 Active Alerts</div>`;
    matchedAlerts.forEach(a => {
      html += `
        <div class="search-result-row" data-type="alert" data-id="${a.id}">
          <div class="search-result-icon">⚠️</div>
          <div class="search-result-content">
            <div class="search-result-main">${a.title || 'Road Alert'}</div>
            <div class="search-result-sub">${a.district || ''} · ${a.time || 'Recent'}</div>
          </div>
          <span class="search-result-badge high">${a.severity || 'Alert'}</span>
        </div>
      `;
    });
  }

  dropdown.innerHTML = html;
  dropdown.classList.add("active");

  dropdown.querySelectorAll(".search-result-row").forEach(row => {
    row.addEventListener("click", () => {
      dropdown.classList.remove("active");
      const type = row.dataset.type;

      if (type === "place") {
        const lat = parseFloat(row.dataset.lat);
        const lon = parseFloat(row.dataset.lon);
        const name = row.dataset.name;
        navigate("map");
        setTimeout(() => {
          highlightMapLocation({ lat, lon, name });
        }, 200);
      } else if (type === "segment") {
        const segId = row.dataset.id;
        const seg = globalSegments.find(s => String(s.id) === String(segId));
        if (seg) {
          navigate("map");
          setTimeout(() => {
            highlightMapSegment(seg);
          }, 200);
        }
      } else if (type === "alert") {
        navigate("alerts");
      }
    });
  });
}

function renderMapSearchResults(query) {
  const dropdown = document.getElementById("map-search-dropdown");
  if (!dropdown) return;

  const q = query.toLowerCase();

  const matchedPlaces = cachedLocations.filter(l => 
    l.name.toLowerCase().includes(q) || (l.state && l.state.toLowerCase().includes(q))
  ).slice(0, 3);

  const matchedSegments = (globalSegments || []).filter(s =>
    (s.name && s.name.toLowerCase().includes(q)) ||
    (s.road && s.road.toLowerCase().includes(q)) ||
    (s.road_name && s.road_name.toLowerCase().includes(q)) ||
    (s.district && s.district.toLowerCase().includes(q))
  ).slice(0, 4);

  if (matchedPlaces.length === 0 && matchedSegments.length === 0) {
    dropdown.innerHTML = `
      <div class="search-empty-state">
        No road matching &ldquo;${query}&rdquo;.<br>
        <small style="color:#a8c4a4;">Press Enter to search coordinates or state bounds.</small>
      </div>
    `;
    dropdown.classList.add("active");
    return;
  }

  let html = "";
  matchedPlaces.forEach(p => {
    html += `
      <div class="search-result-row" data-type="place" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${p.name}">
        <div class="search-result-icon">🏙️</div>
        <div class="search-result-content">
          <div class="search-result-main">${p.name}</div>
          <div class="search-result-sub">${p.state || "Northeast India"}</div>
        </div>
        <span class="search-result-badge safe">City</span>
      </div>
    `;
  });

  matchedSegments.forEach(s => {
    const isBlocked = (s.status || "").toLowerCase() === "blocked";
    const badgeCls = isBlocked ? "critical" : "safe";
    html += `
      <div class="search-result-row" data-type="segment" data-id="${s.id || ''}">
        <div class="search-result-icon">${isBlocked ? '⛔' : '🛣️'}</div>
        <div class="search-result-content">
          <div class="search-result-main">${s.road_name || s.name}</div>
          <div class="search-result-sub">${s.road || ''} · ${s.district || ''}</div>
        </div>
        <span class="search-result-badge ${badgeCls}">${s.status || "Open"}</span>
      </div>
    `;
  });

  dropdown.innerHTML = html;
  dropdown.classList.add("active");

  dropdown.querySelectorAll(".search-result-row").forEach(row => {
    row.addEventListener("click", () => {
      dropdown.classList.remove("active");
      if (row.dataset.type === "place") {
        const lat = parseFloat(row.dataset.lat);
        const lon = parseFloat(row.dataset.lon);
        const name = row.dataset.name;
        highlightMapLocation({ lat, lon, name });
      } else {
        const segId = row.dataset.id;
        const seg = globalSegments.find(s => String(s.id) === String(segId));
        if (seg) highlightMapSegment(seg);
      }
    });
  });
}

async function performMapSearch(query) {
  const dropdown = document.getElementById("map-search-dropdown");
  if (dropdown) dropdown.classList.remove("active");
  const trimmed = (query || "").trim();
  if (!trimmed) return;

  const coordRegex = /^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/;
  const match = trimmed.match(coordRegex);
  if (match) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    highlightMapLocation({ lat, lon, name: `Location (${lat.toFixed(3)}, ${lon.toFixed(3)})` });
    return;
  }

  const qLower = trimmed.toLowerCase();
  const seg = (globalSegments || []).find(s =>
    (s.name && s.name.toLowerCase().includes(qLower)) ||
    (s.road && s.road.toLowerCase().includes(qLower)) ||
    (s.road_name && s.road_name.toLowerCase().includes(qLower))
  );
  if (seg) {
    highlightMapSegment(seg);
    return;
  }

  const loc = (cachedLocations || []).find(l =>
    l.name.toLowerCase().includes(qLower) || (l.state && l.state.toLowerCase().includes(qLower))
  );
  if (loc) {
    highlightMapLocation(loc);
    return;
  }

  const distSel = document.getElementById("filter-district");
  if (distSel) {
    const matchOpt = Array.from(distSel.options).find(o => o.text.toLowerCase().includes(qLower));
    if (matchOpt) {
      distSel.value = matchOpt.value;
      if (window.applyMapFilters) window.applyMapFilters();
      showToast("Filtered by District", matchOpt.text, "info", 2000);
      return;
    }
  }

  try {
    const geo = await resolveLocation(trimmed, currentState);
    if (geo && geo.lat) {
      highlightMapLocation(geo);
    }
  } catch (err) {
    showToast("Search", `No road or location matching "${trimmed}"`, "warning");
  }
}

function setupSearch() {
  const topbarInput = document.getElementById("topbar-search-input");
  const topbarDropdown = document.getElementById("topbar-search-dropdown");
  const mapInput = document.getElementById("map-search-input");
  const mapDropdown = document.getElementById("map-search-dropdown");

  if (cachedLocations && cachedLocations.length > 0) {
    populateLocationDatalists(cachedLocations);
  }

  if (topbarInput && topbarDropdown) {
    let debounceTimer = null;

    topbarInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const query = (topbarInput.value || "").trim();
        if (!query || query.length < 2) {
          topbarDropdown.classList.remove("active");
          topbarDropdown.innerHTML = "";
          return;
        }
        renderTopbarSearchResults(query);
      }, 150);
    });

    topbarInput.addEventListener("focus", () => {
      const query = (topbarInput.value || "").trim();
      if (query.length >= 2) renderTopbarSearchResults(query);
    });

    topbarInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        topbarDropdown.classList.remove("active");
      } else if (e.key === "Enter") {
        e.preventDefault();
        const firstRow = topbarDropdown.querySelector(".search-result-row");
        if (firstRow) {
          firstRow.click();
        } else {
          const q = topbarInput.value.trim();
          if (q) {
            topbarDropdown.classList.remove("active");
            navigate("map");
            setTimeout(() => {
              if (mapInput) {
                mapInput.value = q;
                performMapSearch(q);
              }
            }, 250);
          }
        }
      }
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest("#topbar-search-wrap")) {
        topbarDropdown.classList.remove("active");
      }
    });
  }

  if (mapInput && mapDropdown) {
    let mapDebounce = null;

    mapInput.addEventListener("input", () => {
      clearTimeout(mapDebounce);
      mapDebounce = setTimeout(() => {
        const query = (mapInput.value || "").trim();
        if (!query || query.length < 2) {
          mapDropdown.classList.remove("active");
          mapDropdown.innerHTML = "";
          return;
        }
        renderMapSearchResults(query);
      }, 150);
    });

    mapInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        mapDropdown.classList.remove("active");
      } else if (e.key === "Enter") {
        e.preventDefault();
        const firstRow = mapDropdown.querySelector(".search-result-row");
        if (firstRow) {
          firstRow.click();
        } else {
          performMapSearch(mapInput.value.trim());
        }
      }
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest("#map-search-bar-wrap")) {
        mapDropdown.classList.remove("active");
      }
    });
  }
}

async function loadLocations(state = "all") {
  try {
    const qs = state !== "all" ? `?state=${encodeURIComponent(state)}` : "";
    const res = await fetchAPI(`/locations${qs}`);
    if (res && res.locations) {
      cachedLocations = res.locations;
      populateLocationDatalists(cachedLocations);
    }
  } catch (e) {
    console.warn("Failed to load locations from API, using default NE locations:", e);
    populateLocationDatalists(cachedLocations);
  }
}

function populateLocationDatalists(locs) {
  let datalist = document.getElementById("ne-locations-list");
  if (!datalist) {
    datalist = document.createElement("datalist");
    datalist.id = "ne-locations-list";
    document.body.appendChild(datalist);
  }
  document.getElementById("route-origin")?.setAttribute("list", "ne-locations-list");
  document.getElementById("route-destination")?.setAttribute("list", "ne-locations-list");

  datalist.innerHTML = locs.map(l => 
    `<option value="${l.name}">${l.state ? ` (${l.state})` : ""}</option>`
  ).join("");
}

async function resolveLocation(query, stateHint = "Manipur") {
  const trimmed = (query || "").trim();
  if (!trimmed) return null;

  // 1. Direct coordinate format: "24.817, 93.944" or "24.817 93.944"
  const coordRegex = /^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/;
  const match = trimmed.match(coordRegex);
  if (match) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    return {
      lat: lat,
      lon: lon,
      name: `Point (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
    };
  }

  const qLower = trimmed.toLowerCase();

  // 2. Search local cachedLocations (cities, towns, checkpoints)
  const found = cachedLocations.find(l => 
    l.name.toLowerCase() === qLower || 
    (l.id && l.id.toLowerCase() === qLower) ||
    l.name.toLowerCase().startsWith(qLower)
  ) || cachedLocations.find(l => l.name.toLowerCase().includes(qLower));

  if (found) {
    return { lat: found.lat, lon: found.lon, name: found.name };
  }

  // 3. Search loaded globalSegments
  const segFound = globalSegments.find(s => 
    (s.id && s.id.toLowerCase() === qLower) || 
    (s.name && s.name.toLowerCase().includes(qLower)) ||
    (s.road && s.road.toLowerCase() === qLower)
  );
  if (segFound) {
    return { lat: segFound.lat, lon: segFound.lon, name: segFound.name };
  }

  // 4. Live Geocode via OpenStreetMap Nominatim for any place in NE India
  try {
    const geoQuery = `${trimmed}, Northeast India`;
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(geoQuery)}&limit=1`;
    const resp = await fetch(geoUrl, { headers: { "Accept": "application/json" } });
    if (resp.ok) {
      const results = await resp.json();
      if (results && results.length > 0) {
        return {
          lat: parseFloat(results[0].lat),
          lon: parseFloat(results[0].lon),
          name: results[0].display_name.split(",")[0] || trimmed,
        };
      }
    }
  } catch (err) {
    console.warn("Nominatim geocoding lookup failed:", err);
  }

  // 5. Fallback: State center coordinates
  const stateMeta = NE_STATE_META[stateHint] || NE_STATE_META["all"];
  return {
    lat: stateMeta.center[0],
    lon: stateMeta.center[1],
    name: trimmed,
  };
}

function initRouteMap() {
  routeMap = L.map("route-map", { zoomControl: true })
    .setView([24.817, 93.944], 9);

  // Default OSM tile layer (stored so we can swap it)
  routeCurrentTileLayer = L.tileLayer(MAP_TILES.osm.url, {
    maxZoom: MAP_TILES.osm.maxZoom,
    attribution: MAP_TILES.osm.attribution,
  }).addTo(routeMap);

  // Keep road-risk layer in a named group so we can toggle it
  routeRoadLayer = L.layerGroup().addTo(routeMap);
  drawRoadsOnMap(routeMap, globalSegments, routeRoadLayer);

  routeMap.on("click", (e) => {
    const { lat, lng } = e.latlng;
    const originEl = document.getElementById("route-origin");
    const destEl = document.getElementById("route-destination");
    if (!originEl.value) {
      originEl.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } else if (!destEl.value) {
      destEl.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  });
}

// ── Route Map: tile layer switcher ─────────────────────────────────
let routePitch = 38;
window.setRouteMapLayer = function (mode, preserve3D = true) {
  if (!routeMap) return;
  routeCurrentMapMode = mode;

  if (routeCurrentTileLayer) routeMap.removeLayer(routeCurrentTileLayer);
  const tile = MAP_TILES[mode] || MAP_TILES.osm;
  routeCurrentTileLayer = L.tileLayer(tile.url, {
    maxZoom: tile.maxZoom,
    attribution: tile.attribution,
  }).addTo(routeMap);

  // Keep routes and hazard markers on top by re-adding them
  if (routeShortestLine) { routeMap.removeLayer(routeShortestLine); routeShortestLine.addTo(routeMap); }
  if (routeSafeLine)     { routeMap.removeLayer(routeSafeLine);     routeSafeLine.addTo(routeMap); }

  // Update active button state
  ["osm", "satellite", "terrain"].forEach(m => {
    document.getElementById(`rmap-mode-${m}`)?.classList.toggle("active", m === mode);
  });

  if (!preserve3D && routeIs3D) {
    window.toggleRouteMap3D(false);
  }
};

// ── Route Map: 3D perspective toggle ─────────────────────────────
window.toggleRouteMap3D = function (forceState) {
  if (!routeMap) return;
  routeIs3D = typeof forceState === "boolean" ? forceState : !routeIs3D;
  const mapEl = document.getElementById("route-map");
  const btn   = document.getElementById("rmap-mode-3d");

  if (routeIs3D) {
    mapEl.style.transform      = `perspective(1000px) rotateX(${routePitch}deg) scale(1.18)`;
    mapEl.style.transformOrigin = "center 45%";
    mapEl.style.transition      = "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
    mapEl.classList.add("map-in-3d");
    if (btn) {
      btn.classList.add("active");
      btn.innerHTML = `🏔️ 3D Active <span class="active-dot"></span>`;
    }
    // Terrain gives better depth in 3D
    if (routeCurrentMapMode === "osm") {
      window.setRouteMapLayer("terrain", true);
    }
  } else {
    mapEl.style.transform  = "none";
    mapEl.style.transition = "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
    mapEl.classList.remove("map-in-3d");
    if (btn) {
      btn.classList.remove("active");
      btn.innerHTML = `🏔️ 3D Mode`;
    }
  }

  setTimeout(() => { if (routeMap) routeMap.invalidateSize(); }, 520);
};

// ── Route Planning Vehicle Selection State ─────────────────────
let selectedRouteVehicle = "car";
window.setRouteVehicle = function(type) {
  selectedRouteVehicle = type;
  document.querySelectorAll(".vehicle-btn").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.getElementById(`vbtn-${type}`);
  if (activeBtn) activeBtn.classList.add("active");
  const descEl = document.getElementById("vehicle-profile-desc");
  const descs = {
    car: "Standard passenger vehicle clearance on all asphalt and graded routes.",
    lorry: "Heavy commercial transport: Steep slope penalties (>25°), height/weight clearances verified.",
    bike: "Two-wheeler: High susceptibility to monsoon rains, flooding, and muddy incline slips.",
    emergency: "Priority response: Priority clearance corridors, expedited navigation dispatch."
  };
  if (descEl) descEl.textContent = descs[type] || descs.car;
};

window.findRoute = async function () {
  const originStr = document.getElementById("route-origin").value.trim();
  const destStr = document.getElementById("route-destination").value.trim();
  if (!originStr || !destStr) {
    showToast("Missing input", "Enter start and destination locations", "danger");
    return;
  }

  const btn = document.getElementById("find-route-btn");
  btn.textContent = "Calculating…";
  btn.disabled = true;

  try {
    const origin = await resolveLocation(originStr, currentState);
    const dest   = await resolveLocation(destStr, currentState);

    if (!origin || !dest) {
      showToast("Location error", "Could not locate the requested coordinates", "danger");
      return;
    }

    const stateToSend = (currentState && currentState !== "all") 
      ? currentState 
      : (origin.state || dest.state || "Manipur");

    const data = await postAPI("/route", {
      origin: origin,
      destination: dest,
      state: stateToSend,
      vehicle_type: selectedRouteVehicle,
    });

    displayRouteResults(data, origin, dest);
  } catch (e) {
    showToast("Route error", e.message, "danger");
  } finally {
    btn.innerHTML = `${getIcon('search')} Find Route`;
    btn.disabled = false;
  }
};

function displayRouteResults(data, origin, dest) {
  const sr = data.shortest_route;
  const rr = data.recommended_route;
  routeData = data;
  routeOriginData = origin;
  routeDestData = dest;

  // Show the Focus toggle row
  const focusRow = document.getElementById("route-focus-row");
  if (focusRow) focusRow.style.display = "block";

  // ── Update panel text ───────────────────────────────────────
  document.getElementById("route-results").style.display = "block";
  document.getElementById("route-explanation").textContent = data.reason;

  document.getElementById("shortest-dist").textContent = `${sr.distance_km} km`;
  document.getElementById("shortest-time").textContent = `${sr.duration_min} min · Risk: ${(sr.risk_probability * 100).toFixed(0)}%`;

  const tagShortest = document.getElementById("tag-shortest");
  const issuesShortest = document.getElementById("shortest-issues");

  if (sr.status === "unsafe") {
    tagShortest.textContent = "High Risk / Blocked";
    tagShortest.style.background = "var(--c-vibrant-blue)";
    issuesShortest.textContent = `${sr.blocked_segments} blocked · ${sr.risky_segments} caution · +${sr.delay_min}min delay`;
  } else if (sr.status === "caution") {
    tagShortest.textContent = "Caution Corridor";
    tagShortest.style.background = "var(--c-light-cyan)";
    tagShortest.style.color = "#060E1A";
    issuesShortest.textContent = sr.risky_segments > 0
      ? `${sr.risky_segments} caution section(s) · Drive with care`
      : "Clear route — minor caution areas noted";
  } else {
    tagShortest.textContent = "Safe & Direct Route";
    tagShortest.style.background = "var(--c-soft-mint)";
    tagShortest.style.color = "#060E1A";
    issuesShortest.textContent = "Clear highway · No active hazards detected";
  }

  document.getElementById("rec-dist").textContent = `${rr.distance_km} km`;
  document.getElementById("rec-time").textContent = `${rr.duration_min} min · Risk: ${(rr.risk_probability * 100).toFixed(0)}%`;

  // Swatch colors
  const isRerouted = data.is_rerouted;
  const shortestColor = sr.status === "unsafe" ? "var(--c-vibrant-blue)" : (sr.status === "caution" ? "var(--c-light-cyan)" : "var(--c-soft-mint)");
  document.getElementById("swatch-shortest").style.background    = shortestColor;
  document.getElementById("swatch-recommended").style.background = "var(--c-light-cyan)";

  // ── Comparison table ────────────────────────────────────────
  let shortestBadge = `<span class="badge badge-success">Safe</span>`;
  if (sr.status === "unsafe") {
    shortestBadge = `<span class="badge badge-danger">Unsafe</span>`;
  } else if (sr.status === "caution") {
    shortestBadge = `<span class="badge badge-warning">Caution</span>`;
  }

  const recBadge = isRerouted 
    ? `<span class="badge badge-success">Recommended Bypass</span>`
    : `<span class="badge badge-success">Recommended</span>`;

  document.getElementById("route-compare-body").innerHTML = `
    <tr>
      <td>${isRerouted ? "Shortest (Risky)" : "Shortest Direct"}</td>
      <td>${sr.distance_km} km</td>
      <td>${sr.duration_min} min</td>
      <td style="color:${riskColor(sr.risk_probability)};font-weight:600;">${sr.risk_category} (${(sr.risk_probability * 100).toFixed(0)}%)</td>
      <td>${shortestBadge}</td>
    </tr>
    <tr>
      <td>${isRerouted ? "Safe Detour" : "Recommended Route"}</td>
      <td>${rr.distance_km} km</td>
      <td>${rr.duration_min} min</td>
      <td style="color:${riskColor(rr.risk_probability)};font-weight:600;">${rr.risk_category} (${(rr.risk_probability * 100).toFixed(0)}%)</td>
      <td>${recBadge}</td>
    </tr>`;

  // ── Draw routes on map (Google Maps style) ─────────────────
  if (!routeMap) return;
  if (routeShortestLine) routeMap.removeLayer(routeShortestLine);
  if (routeSafeLine)     routeMap.removeLayer(routeSafeLine);
  if (routeOriginMarker) routeMap.removeLayer(routeOriginMarker);
  if (routeDestMarker)   routeMap.removeLayer(routeDestMarker);
  routeHazardMarkers.forEach(m => routeMap.removeLayer(m));
  routeHazardMarkers = [];

  const validCoords = (arr) => Array.isArray(arr) && arr.length >= 2;

  // Render hazard markers along the route using SVG icons
  const hazardIcon = (status) => L.divIcon({
    html: `<div style="background:${status === 'blocked' ? 'var(--c-vibrant-blue)' : 'var(--c-light-cyan)'};border:2px solid #060E1A;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.5);color:#060E1A;">${status === 'blocked' ? getIcon('blocked') : getIcon('warning')}</div>`,
    className: "", iconSize: [24, 24], iconAnchor: [12, 12],
  });

  (data.hazard_points || []).forEach(hp => {
    const hm = L.marker([hp.lat, hp.lon], { icon: hazardIcon(hp.status) })
      .bindPopup(`<strong>${hp.title}</strong><br>${hp.name}<br>${hp.desc}`)
      .addTo(routeMap);
    routeHazardMarkers.push(hm);
  });

  // Polyline drawing logic
  if (isRerouted) {
    if (validCoords(rr.coords)) {
      routeSafeLine = L.polyline(rr.coords, {
        color:   "#30AFFF",
        weight:  6,
        opacity: 0.90,
        pane:    "overlayPane",
      }).addTo(routeMap);
    }
    if (validCoords(sr.coords)) {
      routeShortestLine = L.polyline(sr.coords, {
        color:     "#92EEFF",
        weight:    4,
        opacity:   0.70,
        dashArray: "10 6",
        pane:      "overlayPane",
      }).addTo(routeMap);
    }
  } else {
    // Single safe direct route: draw clean solid route
    if (validCoords(sr.coords)) {
      routeSafeLine = L.polyline(sr.coords, {
        color:   "#30AFFF",
        weight:  6,
        opacity: 0.90,
        pane:    "overlayPane",
      }).addTo(routeMap);
    }
  }

  // Pin markers using SVG icons
  const pinIcon = (color, type) => L.divIcon({
    html: `<div style="background:${color};border:2px solid #060E1A;border-radius:50% 50% 50% 0;width:28px;height:28px;display:flex;align-items:center;justify-content:center;transform:rotate(-45deg);"><span style="transform:rotate(45deg);display:flex;align-items:center;justify-content:center;color:#060E1A;">${getIcon(type === 'dest' ? 'check' : 'pin')}</span></div>`,
    className: "", iconSize: [28, 28], iconAnchor: [14, 28],
  });
  routeOriginMarker = L.marker([origin.lat, origin.lon], { icon: pinIcon("var(--c-light-cyan)", "origin") })
    .bindPopup(`<strong>Start:</strong> ${origin.name}`).addTo(routeMap);
  routeDestMarker = L.marker([dest.lat, dest.lon], { icon: pinIcon("var(--c-soft-mint)", "dest") })
    .bindPopup(`<strong>Destination:</strong> ${dest.name}`).addTo(routeMap);

  // Fit map to full geometry
  let bounds = routeSafeLine ? routeSafeLine.getBounds() : null;
  if (routeShortestLine) {
    bounds = bounds ? bounds.extend(routeShortestLine.getBounds()) : routeShortestLine.getBounds();
  }
  if (!bounds || !bounds.isValid()) {
    bounds = L.latLngBounds([[origin.lat, origin.lon], [dest.lat, dest.lon]]);
  }
  routeMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });

  // ── Render Turn-by-Turn Navigation Steps ────────────────────
  const activeNavSteps = isRerouted ? (rr.nav_steps || []) : (sr.nav_steps || []);
  renderNavSteps(activeNavSteps);

  // Default selection
  selectRoute(isRerouted ? "recommended" : "shortest");

  showToast(
    isRerouted ? "Hazard Detected — Detour Available" : "Route Safe & Clear",
    isRerouted ? `Safe alternative: ${rr.distance_km}km recommended` : `${sr.distance_km}km · ${sr.duration_min}min`,
    isRerouted ? "warning" : "success"
  );
}

// ── Turn-by-turn nav steps renderer ─────────────────────────────
function renderNavSteps(steps) {
  const section = document.getElementById("nav-steps-section");
  const list    = document.getElementById("nav-steps-list");
  if (!section || !list) return;

  if (!steps || steps.length === 0) {
    section.style.display = "none";
    return;
  }

  const stepIconMap = {
    depart: "pin", arrive: "check", turn: "arrowRight", "new name": "arrowRight",
    continue: "arrowRight", roundabout: "refresh", merge: "arrowRight", ramp: "arrowRight",
  };

  list.innerHTML = steps.map((s, i) => {
    const iconName = stepIconMap[s.type] || "arrowRight";
    const distLabel = s.distance_m >= 1000
      ? `${(s.distance_m / 1000).toFixed(1)} km`
      : `${s.distance_m} m`;
    return `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:5px 6px;border-radius:6px;background:${i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent'};">
        <span style="display:flex;align-items:center;justify-content:center;flex-shrink:0;width:22px;color:var(--c-light-cyan);">${getIcon(iconName)}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.78rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.instruction}</div>
          ${s.distance_m > 0 ? `<div style="font-size:0.68rem;color:var(--text-muted);">${distLabel}</div>` : ""}
        </div>
      </div>`;
  }).join("");

  section.style.display = "block";
}

window.toggleNavSteps = function () {
  const list    = document.getElementById("nav-steps-list");
  const section = document.getElementById("nav-steps-section");
  if (!list || !section) return;
  const collapsed = list.style.display === "none";
  list.style.display = collapsed ? "flex" : "none";
  const btn = section.querySelector("button");
  if (btn) btn.textContent = collapsed ? "Collapse" : "Expand";
};

// Select a route card and highlight that polyline on the map
window.selectRoute = function (key) {
  if (!routeData) return;
  activeRouteKey = key;

  const isRerouted = routeData.is_rerouted;
  const sr = routeData.shortest_route;
  const shortestColor = sr.status === "unsafe" ? "var(--c-vibrant-blue)" : (sr.status === "caution" ? "var(--c-light-cyan)" : "var(--c-soft-mint)");
  const SELECTED_COLOR = "var(--c-vibrant-blue)";
  const ALT_COLOR = "var(--c-light-cyan)";

  // Update card active state
  ["route-shortest-card", "route-rec-card"].forEach(id => {
    document.getElementById(id)?.classList.remove("active");
  });
  ["select-btn-shortest", "select-btn-recommended"].forEach(id => {
    document.getElementById(id)?.classList.remove("active-btn");
  });

  const cardId  = key === "shortest" ? "route-shortest-card" : "route-rec-card";
  const btnId   = key === "shortest" ? "select-btn-shortest"  : "select-btn-recommended";
  document.getElementById(cardId)?.classList.add("active");
  document.getElementById(btnId)?.classList.add("active-btn");

  // Update swatches
  if (key === "shortest") {
    document.getElementById("swatch-shortest").style.background = SELECTED_COLOR;
    document.getElementById("swatch-recommended").style.background = ALT_COLOR;
  } else {
    document.getElementById("swatch-recommended").style.background = SELECTED_COLOR;
    document.getElementById("swatch-shortest").style.background = shortestColor;
  }

  // Re-style polylines
  if (routeShortestLine) {
    if (key === "shortest") {
      routeShortestLine.setStyle({ color: "#30AFFF", weight: 7, opacity: 0.95, dashArray: null });
    } else {
      routeShortestLine.setStyle({ color: "#92EEFF", weight: 4, opacity: 0.50, dashArray: isRerouted ? "10 6" : null });
    }
  }
  if (routeSafeLine) {
    if (key === "recommended") {
      routeSafeLine.setStyle({ color: "#30AFFF", weight: 7, opacity: 0.95 });
    } else {
      routeSafeLine.setStyle({ color: "#92EEFF", weight: 5, opacity: 0.45 });
    }
  }

  // Fit map to selected route's bounds
  const activeLine = (key === "shortest" && routeShortestLine) ? routeShortestLine : routeSafeLine;
  if (activeLine) {
    routeMap.fitBounds(activeLine.getBounds(), { padding: [50, 50], maxZoom: 14 });
  }
};

// Toggle road-risk segments visibility on the route map
window.toggleRouteFocus = function (focused) {
  if (!routeMap || !routeRoadLayer) return;
  if (focused) {
    routeMap.removeLayer(routeRoadLayer);
  } else {
    routeMap.addLayer(routeRoadLayer);
  }
};

window.useGPSLocation = function () {
  if (!navigator.geolocation) { showToast("GPS unavailable", "", "danger"); return; }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      document.getElementById("route-origin").value = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
      showToast("GPS location captured", "", "success", 2000);
    },
    () => showToast("GPS denied", "Allow location access", "danger")
  );
};

window.startNavigation = function () {
  if (!routeData || !routeOriginData || !routeDestData) {
    showToast("No route available", "Please calculate a route first.", "danger");
    return;
  }
  
  // Use the active route, or fallback to recommended
  const activeKey = activeRouteKey || (routeData.is_rerouted ? "recommended" : "shortest");
  const selectedRoute = activeKey === "shortest" ? routeData.shortest_route : routeData.recommended_route;
  
  // Blocked road check
  if (selectedRoute.blocked_segments > 0) {
    const proceed = confirm("Warning: This route contains a blocked road segment. Google Maps may use a different route.\n\nDo you want to continue to Google Maps anyway?");
    if (!proceed) return;
  }
  
  // Build Google Maps URL
  const originStr = `${routeOriginData.lat},${routeOriginData.lon}`;
  const destStr = `${routeDestData.lat},${routeDestData.lon}`;
  
  let waypointsStr = "";
  if (selectedRoute.coords && selectedRoute.coords.length > 10) {
    const coords = selectedRoute.coords;
    const numWaypoints = 5;
    const step = Math.floor(coords.length / (numWaypoints + 1));
    const waypoints = [];
    for (let i = 1; i <= numWaypoints; i++) {
      const idx = i * step;
      if (idx < coords.length - 1) {
        waypoints.push(`${coords[idx][0]},${coords[idx][1]}`);
      }
    }
    if (waypoints.length > 0) {
      waypointsStr = "&waypoints=" + waypoints.join("|");
    }
  }
  
  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&travelmode=driving${waypointsStr}`;
  
  window.open(gmapsUrl, "_blank");
};

window.shareRoute = function () {
  navigator.clipboard.writeText(window.location.href + "#route").then(
    () => showToast("Link copied", "Route link copied to clipboard", "success", 2000)
  );
};

// ─────────────────────────────────────────────────────────────
// VEHICLE TRACKING
// ─────────────────────────────────────────────────────────────
async function initVehiclesScreen() {
  if (!vehiclesMap) {
    vehiclesMap = L.map("vehicles-map", { zoomControl: true })
      .setView([24.817, 93.944], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(vehiclesMap);
    drawRoadsOnMap(vehiclesMap, globalSegments);
  }
  await updateVehicles();
  if (vehicleInterval) clearInterval(vehicleInterval);
  vehicleInterval = setInterval(updateVehicles, 5000);
}

let vehicleMapMarkers = {};

async function updateVehicles() {
  try {
    const data = await fetchAPI("/vehicles");
    const vehicles = data.vehicles || [];

    document.getElementById("vehicle-count-label").textContent = `${vehicles.length} vehicles active`;

    // Update list
    document.getElementById("vehicle-list").innerHTML = vehicles.map(v => `
      <div class="vehicle-list-item" onclick="selectVehicle('${v.id}')">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="display:flex;align-items:center;color:var(--c-light-cyan);">${v.risk_level === "Critical" || v.risk_level === "High" ? getIcon('warning') : getIcon('check')}</span>
          <div>
            <div class="vehicle-id">${v.id}</div>
            <div class="vehicle-driver">${v.driver} · ${v.cargo}</div>
          </div>
          <div style="margin-left:auto;text-align:right;">
            <div style="font-size:0.72rem;color:${riskColor(v.risk_probability)};">${v.risk_level}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);">ETA ${v.eta_min}min</div>
          </div>
        </div>
        <div style="margin-top:4px;display:flex;gap:8px;font-size:0.7rem;color:var(--text-muted);">
          <span style="display:flex;align-items:center;gap:3px;">${getIcon('pin')} ${v.current_road?.substring(0, 25) || "En route"}</span>
          <span>→ ${v.destination}</span>
          <span>${v.speed_kmh} km/h</span>
          ${v.deviation ? `<span style="color:var(--c-vibrant-blue);font-weight:600;">Deviation</span>` : ""}
        </div>
      </div>`).join("");

    // Update map markers
    vehicles.forEach(v => {
      const color = riskColor(v.risk_probability);
      const icon = L.divIcon({
        html: `<div style="background:${color};border:2px solid #060E1A;border-radius:4px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;color:#060E1A;">${getIcon('truck')}</div>`,
        className: "", iconSize: [22, 22], iconAnchor: [11, 11],
      });

      if (vehicleMapMarkers[v.id]) {
        vehicleMapMarkers[v.id].setLatLng([v.lat, v.lon]);
      } else {
        vehicleMapMarkers[v.id] = L.marker([v.lat, v.lon], { icon })
          .bindPopup(`<div class="road-popup"><h4>${v.id}</h4>
            <div class="popup-row"><span class="popup-label">Driver</span><span class="popup-val">${v.driver}</span></div>
            <div class="popup-row"><span class="popup-label">Cargo</span><span class="popup-val">${v.cargo}</span></div>
            <div class="popup-row"><span class="popup-label">Speed</span><span class="popup-val">${v.speed_kmh} km/h</span></div>
            <div class="popup-row"><span class="popup-label">ETA</span><span class="popup-val">${v.eta_min} min</span></div>
            <div class="popup-row"><span class="popup-label">Risk</span><span class="popup-val" style="color:${color}">${v.risk_level}</span></div>
            ${v.deviation ? `<div style="color:var(--c-vibrant-blue);margin-top:4px;font-size:0.78rem;">Route deviation detected</div>` : ""}
          </div>`)
          .addTo(vehiclesMap);
      }
    });

    // Deviation — silent flag (badge already updated; no repeated toasts)
    vehicles.filter(v => v.deviation).forEach(v => {
      void v;
    });
  } catch (e) { console.error("Vehicle update failed", e); }
}

window.selectVehicle = function (id) {
  document.querySelectorAll(".vehicle-list-item").forEach(el => el.classList.remove("selected"));
  event?.target?.closest?.(".vehicle-list-item")?.classList.add("selected");
  const marker = vehicleMapMarkers[id];
  if (marker) { vehiclesMap.setView(marker.getLatLng(), 12); marker.openPopup(); }
};

// ─────────────────────────────────────────────────────────────
// ALERTS SCREEN
// ─────────────────────────────────────────────────────────────
let allAlerts = [];

async function initAlertsScreen() {
  if (!allAlerts.length) await loadAllAlerts();

  // Populate district filter
  const distSel = document.getElementById("alert-district-filter");
  if (distSel && distSel.options.length <= 1) {
    const dists = [...new Set(allAlerts.map(a => a.district))].sort();
    dists.forEach(d => distSel.insertAdjacentHTML("beforeend", `<option value="${d}">${d}</option>`));
  }
}

async function loadAllAlerts() {
  try {
    const data = await fetchAPI("/alerts");
    allAlerts = data.alerts || [];
    renderAlerts(allAlerts);
  } catch (e) { console.error("Alerts load failed", e); }
}

function renderAlerts(alerts) {
  const feed = document.getElementById("alerts-feed");
  if (!feed) return;
  if (!alerts.length) {
    feed.innerHTML = `<div class="empty-state"><div class="empty-icon" style="color:var(--c-light-cyan);">${getIcon('bellOff')}</div><p>No alerts match the filter</p></div>`;
    return;
  }
  feed.innerHTML = alerts.map(a => `
    <div class="glass-card alert-card ${a.severity}" id="alert-${a.id}">
      <div class="alert-header">
        <span style="display:flex;align-items:center;color:var(--c-light-cyan);">${getIcon(a.severity === 'critical' ? 'emergency' : a.severity === 'high' ? 'warning' : 'info')}</span>
        <div class="alert-title">${a.title}</div>
        <span class="badge ${badgeClass(a.severity)}">${a.severity.toUpperCase()}</span>
        <div class="alert-time">${a.time_ago}</div>
      </div>
      <div class="alert-body">${a.message}</div>
      <div class="alert-footer">
        <span class="badge badge-neutral">${a.district}</span>
        <span class="badge badge-neutral">${a.road}</span>
        <button class="btn btn-secondary btn-sm" onclick="viewAlertOnMap('${a.id}',${a.lat},${a.lon})">Map</button>
        ${!a.acknowledged ? `<button class="btn btn-secondary btn-sm" onclick="acknowledgeAlert('${a.id}')">Ack</button>` : `<span style="font-size:0.7rem;color:var(--c-soft-mint);">Acknowledged</span>`}
      </div>
    </div>`).join("");
}

window.filterAlerts = function () {
  const sev = document.getElementById("alert-severity-filter").value;
  const dist = document.getElementById("alert-district-filter").value;
  const type = document.getElementById("alert-type-filter").value;

  let filtered = allAlerts;
  if (sev) filtered = filtered.filter(a => a.severity === sev);
  if (dist) filtered = filtered.filter(a => a.district === dist);
  if (type) filtered = filtered.filter(a => a.type === type);

  renderAlerts(filtered);
};

window.resetAlertFilters = function () {
  ["alert-severity-filter", "alert-district-filter", "alert-type-filter"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  renderAlerts(allAlerts);
};

window.acknowledgeAlert = function (id) {
  const alert = allAlerts.find(a => a.id === id);
  if (alert) {
    alert.acknowledged = true;
    const el = document.getElementById(`alert-${id}`);
    if (el) el.querySelector(".alert-footer").innerHTML += `<span style="font-size:0.7rem;color:var(--c-soft-mint);">Acknowledged</span>`;
  }
};

window.markAllRead = function () {
  allAlerts.forEach(a => a.acknowledged = true);
  const badge = document.getElementById("alert-badge");
  if (badge) badge.textContent = "0";
  renderAlerts(allAlerts);
  showToast("All alerts acknowledged", "", "success", 2000);
};

window.viewAlertOnMap = function (id, lat, lon) {
  navigate("map");
  setTimeout(() => {
    if (mainMap) mainMap.setView([lat, lon], 12);
  }, 400);
};

function handleLiveAlert(alert) {
  allAlerts.unshift(alert);
  if (currentScreen === "alerts") renderAlerts(allAlerts);
  showToast(alert.title, alert.message.substring(0, 80), alert.severity === "critical" ? "danger" : "warning", 5000);
}

// ─────────────────────────────────────────────────────────────
// FIELD REPORTS
// ─────────────────────────────────────────────────────────────
async function initReportsScreen() {
  if (!reportsMap) {
    reportsMap = L.map("reports-map", { zoomControl: true }).setView([24.817, 93.944], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(reportsMap);
  }
  try {
    const data = await fetchAPI("/field-reports");
    const reports = data.reports || [];
    renderReports(reports);

    // Populate road selector
    const sel = document.getElementById("report-road-id");
    if (sel) {
      sel.innerHTML = globalSegments.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
    }
  } catch (e) { console.error("Reports load failed", e); }
}

function renderReports(reports) {
  const list = document.getElementById("report-list");
  if (!list) return;

  // Map markers
  if (reportsMap) {
    if (reportMarkers) reportMarkers.clearLayers();
    reportMarkers = L.layerGroup().addTo(reportsMap);
    reports.forEach(r => {
      L.circleMarker([r.lat, r.lon], {
        radius: 8, fillColor: "var(--c-vibrant-blue)", color: "#fff", weight: 2, fillOpacity: 0.85
      }).bindPopup(`<div class="road-popup"><h4>${r.incident_type}</h4>
        <div class="popup-row"><span class="popup-label">Officer</span><span class="popup-val">${r.officer}</span></div>
        <div class="popup-row"><span class="popup-label">Status</span><span class="popup-val">${r.status}</span></div>
        <div class="popup-row"><span class="popup-label">Road</span><span class="popup-val">${r.road_name}</span></div>
        <p style="margin-top:6px;font-size:0.75rem;color:var(--text-secondary);">${r.description.substring(0, 100)}…</p>
      </div>`).addTo(reportMarkers);
    });
  }

  list.innerHTML = reports.map(r => `
    <div class="report-card" onclick="viewReport('${r.id}')">
      <div class="report-photo" style="display:flex;align-items:center;justify-content:center;color:var(--c-light-cyan);">${getIncidentIcon(r.incident_type)}</div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-weight:600;font-size:0.875rem;">${r.incident_type}</span>
          <span class="badge ${r.severity === 'Critical' ? 'badge-danger' : r.severity === 'High' ? 'badge-warning' : 'badge-neutral'}">${r.severity}</span>
          <span class="report-status ${r.status}" style="margin-left:auto;">${r.status}</span>
        </div>
        <div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:4px;">${r.description.substring(0, 90)}…</div>
        <div style="display:flex;gap:8px;font-size:0.7rem;color:var(--text-muted);">
          <span style="display:flex;align-items:center;gap:2px;">${getIcon('pin')} ${r.road_name}</span>
          <span style="display:flex;align-items:center;gap:2px;">${getIcon('user')} ${r.officer}</span>
          <span style="display:flex;align-items:center;gap:2px;">${getIcon('compass')} ${r.time_ago}</span>
        </div>
      </div>
    </div>`).join("");
}

function getIncidentIcon(type) {
  const iconMap = {
    "Landslide": "mountain",
    "Flood": "flash",
    "Road Damage": "blocked",
    "Bridge Damage": "warning",
    "Debris": "cube",
    "Accident": "emergency",
  };
  return getIcon(iconMap[type] || "reports");
}

window.viewReport = function (id) { showToast("Report #" + id, "Viewing report details", "default", 2000); };

window.openReportModal = function () { document.getElementById("report-modal").classList.add("open"); };
window.closeReportModal = function () { document.getElementById("report-modal").classList.remove("open"); };

window.captureGPS = function () {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    document.getElementById("report-lat").value = coords.latitude.toFixed(5);
    document.getElementById("report-lon").value = coords.longitude.toFixed(5);
    showToast("GPS captured", "", "success", 2000);
  });
};

window.submitReport = async function () {
  const payload = {
    incident_type: document.getElementById("report-type").value,
    severity: document.getElementById("report-severity").value,
    road_id: document.getElementById("report-road-id").value,
    description: document.getElementById("report-description").value,
    lat: parseFloat(document.getElementById("report-lat").value) || 24.817,
    lon: parseFloat(document.getElementById("report-lon").value) || 93.944,
  };
  try {
    const data = await postAPI("/field-reports", payload);
    showToast("Report submitted", `ID: ${data.report_id}`, "success");
    closeReportModal();
    initReportsScreen();
  } catch { showToast("Submit failed", "", "danger"); }
};

// ─────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────
let chartsInitialised = false;

async function initAnalytics() {
  if (chartsInitialised) return;
  try {
    const data = await fetchAPI("/analytics");

    // KPI row
    const kpiEl = document.getElementById("analytics-kpi");
    if (kpiEl) {
      kpiEl.innerHTML = [
        { iconName: "analytics", label: "Incidents (30d)", value: data.summary.total_incidents_30d, color: "var(--c-vibrant-blue)" },
        { iconName: "compass",   label: "Avg Delay (min)", value: data.summary.avg_delay_min, color: "var(--c-light-cyan)" },
        { iconName: "reports",   label: "Peak Risk Month", value: data.summary.peak_risk_month, color: "var(--c-soft-mint)" },
        { iconName: "route",     label: "Most Affected",  value: data.summary.most_affected?.substring(0, 16) || "NH-2", color: "var(--c-warm-cream)" },
      ].map(k => `
        <div class="glass-card kpi-card">
          <div class="kpi-icon" style="color:${k.color};">${getIcon(k.iconName)}</div>
          <div class="kpi-value" style="color:${k.color};font-size:1.5rem;">${k.value}</div>
          <div class="kpi-label">${k.label}</div>
        </div>`).join("");
    }

    const CHART_COLORS = {
      blue: "rgba(48,175,255,0.85)",
      cyan: "rgba(146,238,255,0.85)",
      mint: "rgba(216,255,197,0.85)",
      cream: "rgba(249,240,224,0.85)",
    };

    const chartDefaults = {
      plugins: { legend: { labels: { color: "var(--c-warm-cream)", font: { family: "Poppins", size: 11 } } } },
      scales: {
        x: { ticks: { color: "var(--text-muted)", font: { family: "Poppins", size: 10 } }, grid: { color: "rgba(48,175,255,0.08)" } },
        y: { ticks: { color: "var(--text-muted)", font: { family: "Poppins", size: 10 } }, grid: { color: "rgba(48,175,255,0.08)" } },
      },
    };

    // District disruptions bar chart
    const districts = Object.keys(data.disruptions_by_district);
    new Chart("chart-district", {
      type: "bar",
      data: {
        labels: districts.map(d => d.substring(0, 12)),
        datasets: [{ label: "Incidents", data: Object.values(data.disruptions_by_district), backgroundColor: CHART_COLORS.blue, borderRadius: 4 }],
      },
      options: { ...chartDefaults, responsive: true, maintainAspectRatio: false },
    });

    // Delays line chart
    new Chart("chart-delays", {
      type: "line",
      data: {
        labels: data.delays_over_time.map(d => d.month),
        datasets: [{ label: "Avg Delay (min)", data: data.delays_over_time.map(d => d.avg_delay_min), borderColor: CHART_COLORS.cyan, backgroundColor: "rgba(146,238,255,0.12)", fill: true, tension: 0.4, pointBackgroundColor: CHART_COLORS.cyan }],
      },
      options: { ...chartDefaults, responsive: true, maintainAspectRatio: false },
    });

    // Top corridors horizontal bar
    new Chart("chart-corridors", {
      type: "bar",
      data: {
        labels: data.top_corridors.map(c => c.road),
        datasets: [{ label: "Blockages", data: data.top_corridors.map(c => c.blockages), backgroundColor: CHART_COLORS.blue, borderRadius: 4 }],
      },
      options: { ...chartDefaults, indexAxis: "y", responsive: true, maintainAspectRatio: false },
    });

    // Risk trend area
    new Chart("chart-risk-trend", {
      type: "line",
      data: {
        labels: data.risk_trends.map(r => r.week),
        datasets: [{ label: "Avg Risk Score", data: data.risk_trends.map(r => r.avg_risk), borderColor: CHART_COLORS.mint, backgroundColor: "rgba(216,255,197,0.12)", fill: true, tension: 0.4, pointBackgroundColor: CHART_COLORS.mint }],
      },
      options: { ...chartDefaults, responsive: true, maintainAspectRatio: false, scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, min: 0, max: 1 } } },
    });

    // Status doughnut
    const kpi = await fetchAPI("/kpi");
    new Chart("chart-status", {
      type: "doughnut",
      data: {
        labels: ["Open", "Caution", "Blocked"],
        datasets: [{ data: [kpi.open_segments, kpi.caution_segments, kpi.blocked_roads], backgroundColor: [CHART_COLORS.mint, CHART_COLORS.cyan, CHART_COLORS.blue], borderWidth: 0 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "var(--c-warm-cream)", font: { family: "Poppins", size: 11 } } } } },
    });

    // Weather scatter
    new Chart("chart-weather", {
      type: "scatter",
      data: {
        datasets: [{ label: "Rainfall vs Blockages", data: data.weather_disruptions.map(d => ({ x: d.rainfall_mm, y: d.blockage_count })), backgroundColor: CHART_COLORS.cyan, pointRadius: 5 }],
      },
      options: { ...chartDefaults, responsive: true, maintainAspectRatio: false,
        scales: { x: { ...chartDefaults.scales.x, title: { display: true, text: "Rainfall (mm)", color: "var(--text-muted)" } }, y: { ...chartDefaults.scales.y, title: { display: true, text: "Blockage Count", color: "var(--text-muted)" } } } },
    });

    chartsInitialised = true;
  } catch (e) { console.error("Analytics failed:", e); }
}

// ─────────────────────────────────────────────────────────────
// EMERGENCY MODE — ZONE VISUALIZATION & TELEMETRY
// ─────────────────────────────────────────────────────────────
const EMERGENCY_ZONES = [
  {
    id: "ZONE-NORTH",
    name: "Northern Hill Sector",
    districts: "Senapati & Kangpokpi Districts",
    emergencyType: "Massive Landslide & Highway Lifeline Severed",
    icon: "NORTH",
    status: "CRITICAL EMERGENCY",
    severity: "critical",
    color: "#30AFFF",
    riskScore: "94%",
    rainfall24h: "138 mm",
    activeIncidents: 8,
    blockedRoads: "NH-2 (Imphal–Kohima at Mao, Maram & Kangpokpi)",
    affectedPop: "~52,000 residents",
    evacuationStatus: "Mandatory Ridge Evacuation in Effect",
    directive: "Catastrophic slope collapse along NH-2 corridor. Highway closed indefinitely. Evacuate valley communities via ridge trails to Senapati District Hospital.",
    hotline: "SDRF Northern Command: +91-3871-222100 / Toll-Free: 1070",
    center: [25.32, 93.98],
    shelters: [
      { name: "Senapati District Hospital Shelter", cap: "260 / 300 occupied", status: "Active" },
      { name: "Kangpokpi Mission Compound", cap: "195 / 250 occupied", status: "Active" }
    ],
    coords: [
      [25.70, 93.90], [25.68, 94.25], [25.15, 94.18], [24.98, 94.02],
      [24.96, 93.82], [25.25, 93.75], [25.55, 93.80]
    ]
  },
  {
    id: "ZONE-WEST",
    name: "Western Mountain Sector",
    districts: "Tamenglong & Noney Districts",
    emergencyType: "Severe Mudflow, Mudslide & Railway Bridge Hazard",
    icon: "WEST",
    status: "CRITICAL EMERGENCY",
    severity: "critical",
    color: "#30AFFF",
    riskScore: "89%",
    rainfall24h: "162 mm",
    activeIncidents: 9,
    blockedRoads: "NH-37 (Imphal–Jiribam Highway at Tupul & Awangkhul)",
    affectedPop: "~38,000 residents",
    evacuationStatus: "Flash Mudflow Warning Active",
    directive: "Active torrential mudflow along Ijai river catchment. Railway construction camp & NH-37 roadbed compromised. Transit strictly prohibited without Army clearance.",
    hotline: "Noney Disaster Cell: +91-3877-234201 / Control: 1077",
    center: [24.95, 93.48],
    shelters: [
      { name: "Noney Community Hall Shelter", cap: "210 / 250 occupied", status: "Active" },
      { name: "Tamenglong Higher Secondary Camp", cap: "140 / 300 occupied", status: "Active" }
    ],
    coords: [
      [25.32, 93.30], [25.25, 93.75], [24.78, 93.75], [24.62, 93.50],
      [24.65, 93.25], [25.05, 93.25]
    ]
  },
  {
    id: "ZONE-CENTRAL",
    name: "Central Valley Urban Sector",
    districts: "Imphal West & Imphal East Districts",
    emergencyType: "Urban Flash Flood & River Embankment Breach",
    icon: "CENTRAL",
    status: "HIGH ALERT",
    severity: "high",
    color: "#92EEFF",
    riskScore: "78%",
    rainfall24h: "95 mm",
    activeIncidents: 5,
    blockedRoads: "Nambul River Bank Road & Sanjenthong Underpass",
    affectedPop: "~115,000 residents",
    evacuationStatus: "Lowland Wards Evacuation Advised",
    directive: "Imphal and Nambul rivers flowing 1.2m above danger level. Flash waterlogging in Uripok, Sagolband, and Singjamei. Heavy pumping units deployed.",
    hotline: "Imphal Emergency Control: 0385-2450123 / Control: 112",
    center: [24.82, 93.94],
    shelters: [
      { name: "Imphal Relief Camp Alpha (Khuman Lampak)", cap: "480 / 600 occupied", status: "Active" },
      { name: "D.M. College Relief Hub", cap: "320 / 500 occupied", status: "Active" }
    ],
    coords: [
      [24.98, 93.85], [24.98, 94.06], [24.72, 94.06], [24.68, 93.98],
      [24.70, 93.84], [24.85, 93.82]
    ]
  },
  {
    id: "ZONE-LAKE",
    name: "Loktak Lake & Basin Sector",
    districts: "Bishnupur, Thoubal & Kakching",
    emergencyType: "Loktak Lake Swelling & Basin Agricultural Inundation",
    icon: "LAKE",
    status: "FLOOD WATCH",
    severity: "medium",
    color: "#D8FFC5",
    riskScore: "62%",
    rainfall24h: "84 mm",
    activeIncidents: 3,
    blockedRoads: "Moirang–Kumbi Road (submerged 0.45m)",
    affectedPop: "~42,000 residents",
    evacuationStatus: "Lowland Fishery Evacuation",
    directive: "Lake water level approaching Ithai Barrage discharge capacity. Relocate livestock and vulnerable equipment to elevated ground in Bishnupur highlands.",
    hotline: "Bishnupur Relief Desk: +91-3879-222210",
    center: [24.52, 93.88],
    shelters: [
      { name: "Moirang Multipurpose Shelter", cap: "160 / 300 occupied", status: "Active" },
      { name: "Kakching Sports Complex Shelter", cap: "95 / 250 occupied", status: "Active" }
    ],
    coords: [
      [24.70, 93.84], [24.72, 94.06], [24.45, 94.05], [24.35, 93.85],
      [24.45, 93.75], [24.60, 93.75]
    ]
  },
  {
    id: "ZONE-SOUTH",
    name: "Southern High-Risk Sector",
    districts: "Churachandpur & Pherzawl Districts",
    emergencyType: "Flash Flood, River Overflow & Road Causeway Severing",
    icon: "SOUTH",
    status: "CRITICAL EMERGENCY",
    severity: "critical",
    color: "#30AFFF",
    riskScore: "91%",
    rainfall24h: "145 mm",
    activeIncidents: 7,
    blockedRoads: "NH-102B Highway & Khuga River Dam Causeway",
    affectedPop: "~64,000 residents",
    evacuationStatus: "Red Alert — Move to Relief Camp Immediately",
    directive: "Khuga river surge submerged southern highway causeway. Pherzawl access severed by mountain tributary flooding. SDRF rescue boats deployed.",
    hotline: "Churachandpur Emergency Ops: +91-3874-233150 / 1077",
    center: [24.28, 93.42],
    shelters: [
      { name: "Churachandpur Shelter B (Saikot)", cap: "290 / 350 occupied", status: "Active" },
      { name: "Lamka Indoor Stadium Relief Hub", cap: "340 / 400 occupied", status: "Active" }
    ],
    coords: [
      [24.60, 93.30], [24.60, 93.75], [24.25, 93.75], [23.90, 93.55],
      [23.85, 93.10], [24.30, 93.10], [24.50, 93.25]
    ]
  },
  {
    id: "ZONE-EAST",
    name: "Eastern Mountain Sector",
    districts: "Ukhrul & Kamjong Districts",
    emergencyType: "Heavy Torrential Rainfall & Hill Cut-off Risk",
    icon: "EAST",
    status: "HAZARD WATCH",
    severity: "medium",
    color: "#D8FFC5",
    riskScore: "58%",
    rainfall24h: "102 mm",
    activeIncidents: 2,
    blockedRoads: "SH-5 Jessami Road (debris clearance under operation)",
    affectedPop: "~29,000 residents",
    evacuationStatus: "Precautionary Monitoring",
    directive: "Intense cloudburst activity across upper ridges. Loose gravel, boulder hazards, and reduced visibility on SH-5. Heavy transport prohibited.",
    hotline: "Ukhrul Control Room: +91-3870-265215",
    center: [25.10, 94.45],
    shelters: [
      { name: "Ukhrul Town Hall Shelter", cap: "80 / 200 occupied", status: "Standby" },
      { name: "Kamjong Sub-Divisional Camp", cap: "45 / 150 occupied", status: "Standby" }
    ],
    coords: [
      [25.68, 94.25], [25.50, 94.75], [24.75, 94.70], [24.65, 94.30],
      [24.90, 94.15], [25.25, 94.20]
    ]
  },
  {
    id: "ZONE-SOUTHEAST",
    name: "South-Eastern Border Sector",
    districts: "Chandel & Tengnoupal Districts",
    emergencyType: "Cross-Border Highway Rockslide & Runoff Surge",
    icon: "SOUTHEAST",
    status: "HIGH ALERT",
    severity: "high",
    color: "#92EEFF",
    riskScore: "76%",
    rainfall24h: "120 mm",
    activeIncidents: 4,
    blockedRoads: "NH-102 (Pallel–Tengnoupal–Moreh Highway at Lokchao)",
    affectedPop: "~33,000 residents",
    evacuationStatus: "Restricted Movement Order Active",
    directive: "Debris avalanche near Lokchao bridge. Border commercial convoy halted. SDRF earthmovers actively clearing single-lane passage.",
    hotline: "Tengnoupal Border Command: +91-3872-244102",
    center: [24.32, 94.12],
    shelters: [
      { name: "Pallel Community Relief Camp", cap: "135 / 200 occupied", status: "Active" },
      { name: "Chandel Maha Union Shelter", cap: "90 / 150 occupied", status: "Active" }
    ],
    coords: [
      [24.65, 93.95], [24.65, 94.30], [24.45, 94.45], [24.10, 94.30],
      [24.05, 93.90], [24.35, 93.85]
    ]
  },
  {
    id: "ZONE-GATEWAY",
    name: "Western Logistics Gateway",
    districts: "Jiribam District",
    emergencyType: "Safe Evacuation & Emergency Relief Supply Intake Hub",
    icon: "GATEWAY",
    status: "SAFE STAGING ZONE",
    severity: "safe",
    color: "#D8FFC5",
    riskScore: "18%",
    rainfall24h: "28 mm",
    activeIncidents: 0,
    blockedRoads: "None — Internal roadways and railway link fully open",
    affectedPop: "Designated Safe Haven",
    evacuationStatus: "Active Intake & Distribution Center",
    directive: "Primary logistics staging zone for all relief supplies arriving from Assam. Medical emergency convoys, fuel tankers, and dry rations cleared for intake.",
    hotline: "Jiribam Logistics Hub: +91-3876-231120 / Control: 1070",
    center: [24.78, 93.12],
    shelters: [
      { name: "Jiribam Central Transit Camp", cap: "150 / 500 occupied", status: "Intake Hub" },
      { name: "Railway Station Medical Post", cap: "45 / 100 occupied", status: "Active" }
    ],
    coords: [
      [25.02, 93.05], [25.02, 93.25], [24.55, 93.25], [24.55, 93.05]
    ]
  }
];

let emergencyZoneLayers = [];
let activeLockedZone = null;

function renderZoneHUD(zone) {
  const hud = document.getElementById("emergency-zone-hud");
  if (!hud || !zone) return;

  const severityClass = zone.severity || "critical";
  const badgeClass = `hud-zone-tag ${severityClass}`;
  const bannerClass = `hud-emergency-banner ${severityClass}`;
  const typeClass = `hud-emergency-type ${severityClass}`;

  const sheltersHtml = (zone.shelters || []).map(s => `
    <div class="hud-shelter-item">
      <span class="hud-shelter-name">${s.name}</span>
      <span class="hud-shelter-cap">${s.cap}</span>
    </div>
  `).join("");

  hud.innerHTML = `
    <div class="hud-content">
      <div class="hud-header">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="${badgeClass}">${zone.status}</span>
          <span style="font-size:0.7rem;color:var(--text-muted);">Zone ID: ${zone.id}</span>
        </div>
        <h3 class="hud-title">${zone.name}</h3>
        <div class="hud-districts" style="display:flex;align-items:center;gap:3px;">${getIcon('pin')} ${zone.districts}</div>
      </div>

      <!-- Emergency Affecting This Zone -->
      <div class="${bannerClass}">
        <div class="${typeClass}">
          <span>${zone.emergencyType}</span>
        </div>
        <div class="hud-emergency-desc">${zone.directive}</div>
      </div>

      <!-- Telemetry Grid -->
      <div class="hud-grid">
        <div class="hud-metric">
          <div class="hud-metric-label">Risk Probability</div>
          <div class="hud-metric-val ${zone.severity === 'critical' ? 'text-danger' : zone.severity === 'safe' ? 'text-success' : 'text-warning'}">${zone.riskScore}</div>
        </div>
        <div class="hud-metric">
          <div class="hud-metric-label">Rainfall (24h)</div>
          <div class="hud-metric-val ${parseFloat(zone.rainfall24h) > 100 ? 'text-danger' : 'text-warning'}">${zone.rainfall24h}</div>
        </div>
        <div class="hud-metric">
          <div class="hud-metric-label">Active Incidents</div>
          <div class="hud-metric-val ${zone.activeIncidents > 5 ? 'text-danger' : 'text-warning'}">${zone.activeIncidents} Active</div>
        </div>
        <div class="hud-metric">
          <div class="hud-metric-label">Affected Population</div>
          <div class="hud-metric-val">${zone.affectedPop}</div>
        </div>
      </div>

      <!-- Blocked Roads -->
      <div>
        <div class="hud-section-title">Impacted Roadways & Transit</div>
        <div style="font-size:0.75rem;color:var(--c-warm-cream);background:rgba(48,175,255,0.06);padding:6px 9px;border-radius:4px;border:1px solid var(--border-subtle);">
          ${zone.blockedRoads}
        </div>
      </div>

      <!-- Evacuation Shelters -->
      <div>
        <div class="hud-section-title">Designated Shelters & Relief Camps</div>
        <div class="hud-shelters-list">
          ${sheltersHtml}
        </div>
      </div>

      <!-- Evacuation Directive -->
      <div>
        <div class="hud-section-title">Evacuation Protocol</div>
        <div class="hud-directive-box">
          <strong>${zone.evacuationStatus}</strong>: Immediate adherence mandatory. Keep communication channels open on 433 MHz SDRF band.
        </div>
      </div>

      <!-- Emergency Hotline -->
      <div class="hud-hotline">
        <span><strong>Dispatch:</strong> ${zone.hotline}</span>
      </div>
    </div>
  `;
}

function resetZoneHUD() {
  const hud = document.getElementById("emergency-zone-hud");
  if (!hud) return;

  const criticalCount = EMERGENCY_ZONES.filter(z => z.severity === "critical").length;
  const highCount     = EMERGENCY_ZONES.filter(z => z.severity === "high").length;
  const watchCount    = EMERGENCY_ZONES.filter(z => z.severity === "medium").length;
  const safeCount     = EMERGENCY_ZONES.filter(z => z.severity === "safe").length;

  hud.innerHTML = `
    <div class="hud-empty-state">
      <div style="display:flex;justify-content:center;color:var(--c-light-cyan);margin-bottom:8px;">${getIcon('emergency')}</div>
      <div style="font-weight:700;font-size:0.92rem;color:var(--c-light-cyan);margin-bottom:6px;letter-spacing:0.04em;">EMERGENCY ZONE TELEMETRY</div>
      <div style="color:var(--text-muted);font-size:0.75rem;line-height:1.45;margin-bottom:14px;">
        Move your cursor over any emergency sector on the map to inspect live emergency type, hazard breakdown, active road blockages, and evacuation directives.
      </div>
      <div style="width:100%;background:rgba(48,175,255,0.05);border-radius:8px;border:1px solid var(--border-subtle);padding:10px 14px;display:flex;justify-content:space-around;font-size:0.74rem;">
        <div><span style="color:var(--c-vibrant-blue);font-weight:700;font-size:1rem;">${criticalCount}</span><br/><span style="color:var(--text-muted);">Critical</span></div>
        <div><span style="color:var(--c-light-cyan);font-weight:700;font-size:1rem;">${highCount}</span><br/><span style="color:var(--text-muted);">High Alert</span></div>
        <div><span style="color:var(--c-soft-mint);font-weight:700;font-size:1rem;">${watchCount}</span><br/><span style="color:var(--text-muted);">Watch</span></div>
        <div><span style="color:var(--c-warm-cream);font-weight:700;font-size:1rem;">${safeCount}</span><br/><span style="color:var(--text-muted);">Safe Hub</span></div>
      </div>
    </div>
  `;
}

window.toggleEmergency = function () {
  const overlay = document.getElementById("emergency-overlay");
  const isActive = overlay.classList.toggle("active");

  if (isActive && !emergencyMap) {
    emergencyMap = L.map("emergency-map", { zoomControl: true }).setView([24.78, 93.90], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(emergencyMap);

    // ── 1. ZONE VISUALIZATION ──────────────────────────────────
    EMERGENCY_ZONES.forEach(zone => {
      const polygon = L.polygon(zone.coords, {
        color: zone.color,
        weight: 2,
        fillColor: zone.color,
        fillOpacity: 0.38,
        dashArray: zone.severity === "critical" ? "6 4" : null,
      }).addTo(emergencyMap);

      emergencyZoneLayers.push({ polygon, zone });

      // Interactive Cursor Hover Events
      polygon.on("mouseover", (e) => {
        if (!activeLockedZone) {
          polygon.setStyle({
            weight: 3.5,
            color: "#FFFFFF",
            fillOpacity: 0.65,
            dashArray: null,
          });
          polygon.bringToFront();
          renderZoneHUD(zone);
        }
      });

      polygon.on("mouseout", (e) => {
        if (activeLockedZone !== zone.id) {
          polygon.setStyle({
            weight: 2,
            color: zone.color,
            fillOpacity: 0.38,
            dashArray: zone.severity === "critical" ? "6 4" : null,
          });
          if (!activeLockedZone) {
            resetZoneHUD();
          }
        }
      });

      polygon.on("click", (e) => {
        if (activeLockedZone === zone.id) {
          activeLockedZone = null;
          polygon.setStyle({
            weight: 2,
            color: zone.color,
            fillOpacity: 0.38,
            dashArray: zone.severity === "critical" ? "6 4" : null,
          });
          resetZoneHUD();
        } else {
          activeLockedZone = zone.id;
          polygon.setStyle({
            weight: 3.5,
            color: "#FFFFFF",
            fillOpacity: 0.70,
            dashArray: null,
          });
          polygon.bringToFront();
          renderZoneHUD(zone);
          emergencyMap.fitBounds(polygon.getBounds(), { padding: [40, 40] });
        }
      });

      // Rich tooltip following the cursor
      polygon.bindTooltip(`
        <div style="font-weight:700;font-size:0.82rem;margin-bottom:2px;">
          ${zone.name}
        </div>
        <div style="color:var(--c-light-cyan);font-weight:700;font-size:0.75rem;margin:2px 0;">
          Emergency: ${zone.emergencyType}
        </div>
        <div style="color:#cfd8dc;font-size:0.7rem;">
          Status: <strong>${zone.status}</strong> · Risk: <strong>${zone.riskScore}</strong> · Rain: <strong>${zone.rainfall24h}</strong>
        </div>
        <div style="color:var(--c-light-cyan);font-size:0.67rem;margin-top:3px;">
          Move cursor or click to inspect complete telemetry & shelter protocols
        </div>
      `, {
        sticky: true,
        className: `emergency-zone-tooltip ${zone.severity}`,
      });

      // Center label tag on map
      const labelIcon = L.divIcon({
        html: `<div class="zone-center-label" style="border-color:${zone.color};"><span>${zone.name}</span></div>`,
        className: "",
        iconSize: [120, 22],
        iconAnchor: [60, 11],
      });
      L.marker(zone.center, { icon: labelIcon, interactive: false }).addTo(emergencyMap);

      // Shelter markers within the zone
      (zone.shelters || []).forEach(s => {
        const sLat = zone.center[0] + (Math.random() - 0.5) * 0.12;
        const sLon = zone.center[1] + (Math.random() - 0.5) * 0.12;
        const sIcon = L.divIcon({
          html: `<div style="background:var(--c-vibrant-blue);border:2px solid #060E1A;border-radius:6px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.6);color:#060E1A;">${getIcon('emergency')}</div>`,
          className: "", iconSize: [26, 26], iconAnchor: [13, 13],
        });
        L.marker([sLat, sLon], { icon: sIcon })
          .bindPopup(`<div class="road-popup"><h4>${s.name}</h4><div class="popup-row"><span class="popup-label">Capacity</span><span class="popup-val">${s.cap}</span></div><div class="popup-row"><span class="popup-label">Zone</span><span class="popup-val">${zone.name}</span></div></div>`)
          .addTo(emergencyMap);
      });
    });

    // ── 2. INITIAL HUD STATE ────────────────────────────────────
    resetZoneHUD();

    // ── 3. EMERGENCY STATS FOOTER ──────────────────────────────
    const criticalCount = EMERGENCY_ZONES.filter(z => z.severity === "critical").length;
    const highCount     = EMERGENCY_ZONES.filter(z => z.severity === "high").length;
    const totalShelters = EMERGENCY_ZONES.reduce((acc, z) => acc + (z.shelters ? z.shelters.length : 0), 0);

    document.getElementById("emergency-stats").innerHTML = `
      <div><strong>${criticalCount} Critical Emergency Sectors</strong></div>
      <div><strong>${highCount} High Alert Zones</strong> · <strong>${totalShelters} Operational Shelters</strong></div>`;
  }

  if (isActive) {
    showToast("Emergency Mode ACTIVE", "Zone visualization enabled. Move cursor over zones to view details.", "danger", 4000);
    setTimeout(() => { if (emergencyMap) emergencyMap.invalidateSize(); }, 300);
  }
};

window.emergencyBroadcast = async function () {
  try {
    const data = await postAPI("/emergency/broadcast", { message: "Emergency alert from ManipurRiskAI" });
    showToast("BROADCAST SENT", `ID: ${data.broadcast_id} · Channels: ${data.channels.join(", ")}`, "danger", 5000);
  } catch {
    showToast("BROADCAST", "Signal sent to all units (offline mode)", "danger", 4000);
  }
};

// ─────────────────────────────────────────────────────────────
// EXPORT UTILITIES
// ─────────────────────────────────────────────────────────────
window.exportPDF = function () {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text("ManipurRiskAI — Road Risk Report", 20, 20);
  doc.setFontSize(12);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 20, 35);
  doc.text(`Total Segments: ${globalSegments.length}`, 20, 50);
  doc.text(`Blocked Roads: ${globalSegments.filter(s => s.risk_probability >= 0.5).length}`, 20, 65);
  doc.text(`Safe Routes: ${globalSegments.filter(s => s.risk_probability < 0.3).length}`, 20, 80);
  doc.save("ManipurRiskAI_Report.pdf");
  showToast("PDF exported", "", "success", 2000);
};

window.exportExcel = function () {
  const rows = globalSegments.map(s => ({
    "Road Name": s.name, "Road": s.road, "District": s.district,
    "Risk %": s.risk_percentage, "Status": s.status, "Category": s.risk_category,
    "Rainfall mm": s.rainfall_mm, "Slope °": s.slope_degrees,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "RoadRisk");
  XLSX.writeFile(wb, "ManipurRiskAI_Data.xlsx");
  showToast("Excel exported", "", "success", 2000);
};

window.exportDashboard = function () { exportPDF(); };

// ─────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
