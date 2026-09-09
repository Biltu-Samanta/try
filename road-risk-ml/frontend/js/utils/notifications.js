/* notifications.js — Toast system + SSE alerts with mute control */

import { API_BASE } from "./api.js";
import { getIcon } from "./icons.js";

const container = () => document.getElementById("toast-container");

// ── Notification mute state ──────────────────────────────────────
export let notificationsEnabled = true;
const MUTE_KEY = "neariskai_notifications_muted";

export function setNotificationsEnabled(enabled) {
  notificationsEnabled = enabled;
  localStorage.setItem(MUTE_KEY, enabled ? "false" : "true");

  // Sync mute button icon
  const btn = document.getElementById("mute-alerts-btn");
  if (btn) {
    btn.title = enabled ? "Mute Notifications" : "Unmute Notifications";
    btn.innerHTML = enabled ? getIcon("bell") : getIcon("bellOff");
  }
}

export function loadMuteState() {
  const muted = localStorage.getItem(MUTE_KEY) === "true";
  notificationsEnabled = !muted;
  const btn = document.getElementById("mute-alerts-btn");
  if (btn) {
    btn.innerHTML = notificationsEnabled ? getIcon("bell") : getIcon("bellOff");
    btn.title = notificationsEnabled ? "Mute Notifications" : "Unmute Notifications";
  }
}

// ── Toast Display ────────────────────────────────────────────────
// type: 'success' | 'danger' | 'warning' | 'default'
// critical: if true, always shows even when muted (e.g. API offline, GPS error)
export function showToast(title, msg = "", type = "default", duration = 4000, critical = false) {
  if (!notificationsEnabled && !critical) return;

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="toast-title">${title}</div>${msg ? `<div class="toast-msg">${msg}</div>` : ""}`;
  container().appendChild(el);
  setTimeout(() => {
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 350);
  }, duration);
}

// ── SSE Alert Stream ──────────────────────────────────────────────
let sseSource = null;
let lastSseToastTime = 0; // timestamp of last SSE toast — rate limit to 1 per 60s

export function startSSEStream(onAlert) {
  if (sseSource) sseSource.close();
  try {
    sseSource = new EventSource(`${API_BASE}/stream/alerts`);
    sseSource.onmessage = (ev) => {
      try {
        const alert = JSON.parse(ev.data);
        onAlert(alert);

        // Update badge count (always, regardless of mute)
        const badge = document.getElementById("alert-badge");
        if (badge) {
          const current = parseInt(badge.textContent) || 0;
          badge.textContent = current + 1;
        }

        // Rate-limit toast: max 1 SSE toast every 60 seconds
        const now = Date.now();
        if (now - lastSseToastTime >= 60000) {
          lastSseToastTime = now;
          showToast(
            `${alert.severity ? alert.severity.toUpperCase() + ': ' : ''}${alert.title}`,
            alert.message?.substring(0, 80),
            alert.severity === "critical" ? "danger" : "warning",
            5000,
            false  // respects mute
          );
        }
      } catch (e) {}
    };
    sseSource.onerror = () => {
      const label = document.getElementById("sse-status-label");
      if (label) label.textContent = "Feed reconnecting…";
    };
    sseSource.onopen = () => {
      const label = document.getElementById("sse-status-label");
      if (label) label.textContent = "Live feed active";
    };
  } catch (e) {
    console.warn("[SSE] Not available:", e);
  }
}

export function stopSSEStream() {
  if (sseSource) { sseSource.close(); sseSource = null; }
}

// ── Browser Push Notifications ─────────────────────────────────────

const NOTIF_STORAGE_KEY = "manipurrisk_push_notif_enabled";

export function initNotifications() {
  // Load mute state first
  loadMuteState();

  const toggle = document.getElementById("push-notif");
  if (!toggle) return;

  // Browser doesn't support notifications at all
  if (!("Notification" in window)) {
    toggle.checked = false;
    toggle.disabled = true;
    return;
  }

  // Sync initial state from permission + localStorage
  const stored = localStorage.getItem(NOTIF_STORAGE_KEY);
  if (Notification.permission === "granted" && stored === "true") {
    toggle.checked = true;
  } else if (Notification.permission === "denied") {
    toggle.checked = false;
    localStorage.setItem(NOTIF_STORAGE_KEY, "false");
  } else {
    toggle.checked = false;
    localStorage.setItem(NOTIF_STORAGE_KEY, "false");
  }

  toggle.addEventListener("change", async (e) => {
    if (e.target.checked) {
      if (Notification.permission === "granted") {
        localStorage.setItem(NOTIF_STORAGE_KEY, "true");
        new Notification("NorthEastRiskAI", { body: "Notifications are active." });
        showToast("Notifications Enabled", "", "success", 2000);
      } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          localStorage.setItem(NOTIF_STORAGE_KEY, "true");
          new Notification("NorthEastRiskAI", { body: "Notifications are active." });
          showToast("Notifications Enabled", "", "success", 2000);
        } else {
          e.target.checked = false;
          localStorage.setItem(NOTIF_STORAGE_KEY, "false");
          showToast("Permission Denied", "Enable notifications in browser settings.", "danger", 3000);
        }
      } else {
        e.target.checked = false;
        localStorage.setItem(NOTIF_STORAGE_KEY, "false");
        showToast("Permission Denied", "Enable notifications in browser settings.", "danger", 3000);
      }
    } else {
      localStorage.setItem(NOTIF_STORAGE_KEY, "false");
      showToast("Notifications Disabled", "Desktop alerts are turned off.", "default", 2000);
    }
  });
}
