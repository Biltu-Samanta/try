import { useState, useEffect } from "react";

export type MapMode = "2D" | "3D" | "Terrain";

const STORAGE_KEY = "ner-map-mode";

// Helper to get initial mode from localStorage safely
function getStoredMapMode(): MapMode {
  if (typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as MapMode | null;
      if (saved === "2D" || saved === "3D" || saved === "Terrain") {
        return saved;
      }
    } catch {}
  }
  return "2D";
}

// Module-level singleton state so all route components and AppShell mounts stay synchronized
let currentGlobalMode: MapMode = getStoredMapMode();
const subscribers = new Set<(mode: MapMode) => void>();

export function setGlobalMapMode(mode: MapMode) {
  currentGlobalMode = mode;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  }
  subscribers.forEach((callback) => {
    try {
      callback(mode);
    } catch {}
  });
}

export function getGlobalMapMode(): MapMode {
  return currentGlobalMode;
}

export function useMapMode(): [MapMode, (mode: MapMode) => void] {
  const [mode, setModeState] = useState<MapMode>(() => currentGlobalMode);

  useEffect(() => {
    // If the global mode changed while this component was unmounted, sync immediately
    if (mode !== currentGlobalMode) {
      setModeState(currentGlobalMode);
    }

    const handler = (newMode: MapMode) => {
      setModeState(newMode);
    };

    subscribers.add(handler);
    return () => {
      subscribers.delete(handler);
    };
  }, [mode]);

  return [mode, setGlobalMapMode];
}
