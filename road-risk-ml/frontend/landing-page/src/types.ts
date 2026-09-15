export interface GeoNode {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  elevation: string;
  status: 'active' | 'calibrating' | 'syncing';
  description: string;
  sarFrequency: string;
}

export interface LayerState {
  satelliteMesh: boolean;
  topographyContour: boolean;
  thermalInsar: boolean;
  lidarPoints: boolean;
  atmosphereGlow: boolean;
  orbitalTracks: boolean;
}

export type ViewMode = 'globe' | 'terrain' | 'orbital' | 'insar';

export type MapStyle = 'satellite' | 'radar' | 'topo';

export interface TelemetryData {
  satellitesOnline: number;
  radarBandwidth: string;
  latencyMs: number;
  activeSensors: number;
  globalCoverage: number;
}
