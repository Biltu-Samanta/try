/* notifications.js — Toast system + SSE alerts */

import { API_BASE } from "./api.js";

const container = () => document.getElementById("toast-container");

export function showToast(title, msg = "", type = "default", duration = 4000) {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="toast-title">${title}</div>${msg ? `<div class="toast-msg">${msg}</div>` : ""}`;
  container().appendChild(el);
  setTimeout(() => {
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 350);
  }, duration);
}

// ── SSE Alert Stream ──────────────────────────────────────────
let sseSource = null;

export function startSSEStream(onAlert) {
  if (sseSource) sseSource.close();
  try {
    sseSource = new EventSource(`${API_BASE}/stream/alerts`);
    sseSource.onmessage = (ev) => {
      try {
        const alert = JSON.parse(ev.data);
        onAlert(alert);
        // Update badge
        const badge = document.getElementById("alert-badge");
        if (badge) {
          const current = parseInt(badge.textContent) || 0;
          badge.textContent = current + 1;
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

// ── Browser Push Notifications ─────────────────────────────────

const NOTIF_STORAGE_KEY = "manipurrisk_push_notif_enabled";

export function initNotifications() {
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
    // permission is "default" or stored is not "true"
    toggle.checked = false;
    localStorage.setItem(NOTIF_STORAGE_KEY, "false");
  }

  toggle.addEventListener("change", async (e) => {
    if (e.target.checked) {
      if (Notification.permission === "granted") {
        localStorage.setItem(NOTIF_STORAGE_KEY, "true");
        new Notification("ManipurRiskAI", { body: "Notifications are active." });
        showToast("🔔 Notifications Enabled", "", "success", 2000);
      } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          localStorage.setItem(NOTIF_STORAGE_KEY, "true");
          new Notification("ManipurRiskAI", { body: "Notifications are active." });
          showToast("🔔 Notifications Enabled", "", "success", 2000);
        } else {
          e.target.checked = false;
          localStorage.setItem(NOTIF_STORAGE_KEY, "false");
          showToast("❌ Permission Denied", "Enable notifications in browser settings.", "danger", 3000);
        }
      } else {
        // permission was previously denied
        e.target.checked = false;
        localStorage.setItem(NOTIF_STORAGE_KEY, "false");
        showToast("❌ Permission Denied", "Enable notifications in browser settings.", "danger", 3000);
      }
    } else {
      localStorage.setItem(NOTIF_STORAGE_KEY, "false");
      showToast("🔕 Notifications Disabled", "You won't receive desktop alerts.", "default", 2000);
    }
  });
}

