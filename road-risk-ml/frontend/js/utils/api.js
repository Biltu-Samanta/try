/* api.js — Centralised API client */

export const API_BASE = "http://localhost:5050/api";

let _loadingCount = 0;
const _refreshBtn = () => document.getElementById("refresh-btn");

function setLoading(state) {
  _loadingCount += state ? 1 : -1;
  const btn = _refreshBtn();
  if (btn) btn.style.transform = _loadingCount > 0 ? "rotate(360deg)" : "";
}

export async function fetchAPI(endpoint, options = {}) {
  setLoading(true);
  try {
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return await response.json();
  } catch (err) {
    console.error(`[API] ${endpoint}:`, err);
    throw err;
  } finally {
    setLoading(false);
  }
}

export async function postAPI(endpoint, body) {
  return fetchAPI(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
