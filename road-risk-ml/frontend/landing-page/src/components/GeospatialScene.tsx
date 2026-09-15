import React, { useEffect, useRef, useState } from 'react';
import { Map, Marker } from 'maplibre-gl';
import { GEO_NODES } from '../data/geoNodes';
import { ORBITAL_SATELLITES } from '../data/orbitalTracks';
import { GeoNode, ViewMode, MapStyle } from '../types';

interface GeospatialSceneProps {
  activeNode: GeoNode | null;
  onSelectNode: (node: GeoNode) => void;
  viewMode: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  scrollProgress?: number;
  atmosphereGlow?: boolean;
  satelliteTracks?: boolean;
}

export const GeospatialScene: React.FC<GeospatialSceneProps> = ({
  activeNode,
  onSelectNode,
  viewMode,
  scrollProgress = 0,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const isSpinningRef = useRef<boolean>(true);
  const animFrameRef = useRef<number | null>(null);
  const userInteractingRef = useRef<boolean>(false);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll & Mouse parallax camera synchronization refs
  const scrollProgressRef = useRef<number>(scrollProgress);
  const lastScrollProgressRef = useRef<number>(scrollProgress);
  const mouseParallaxRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentPitchRef = useRef<number>(36);
  const currentZoomRef = useRef<number>(3.35);
  const currentBearingRef = useRef<number>(-5);
  const currentLatRef = useRef<number>(activeNode ? activeNode.lat : 22.5937);
  const currentLngRef = useRef<number>(activeNode ? activeNode.lng : 78.9629);

  useEffect(() => {
    scrollProgressRef.current = scrollProgress;
  }, [scrollProgress]);

  // Track subtle mouse movement across screen for 3D globe parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const normX = (e.clientX / window.innerWidth - 0.5) * 2;
      const normY = (e.clientY / window.innerHeight - 0.5) * 2;
      mouseParallaxRef.current = { x: normX, y: normY };
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Map state
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapStyle] = useState<MapStyle>('satellite');
  const [terrainExaggeration] = useState<number>(1.8);
  const [isAutoSpin] = useState<boolean>(true);
  const [activeLayers] = useState({
    satelliteImagery: true,
    terrainDem: true,
    hillshadeMesh: true,
    orbitalTracks: true,
    groundMarkers: true,
  });

  // Keep isSpinningRef in sync
  useEffect(() => {
    isSpinningRef.current = isAutoSpin && viewMode === 'globe';
  }, [isAutoSpin, viewMode]);

  // 1. Initialize MapLibre GL 3D Map
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Build GeoJSON for satellite orbital paths
    const orbitalGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: ORBITAL_SATELLITES.map((sat) => ({
        type: 'Feature',
        properties: {
          id: sat.id,
          name: sat.name,
          color: sat.color,
        },
        geometry: {
          type: 'LineString',
          coordinates: sat.coordinates,
        },
      })),
    };

    const initialLng = activeNode ? activeNode.lng : 78.9629;
    const initialLat = activeNode ? activeNode.lat : 22.5937;

    const map = new Map({
      container,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          esriSatellite: {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            maxzoom: 19,
          },
          darkBasemap: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            maxzoom: 19,
          },
          terrainSource: {
            type: 'raster-dem',
            tiles: [
              'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
            ],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 15,
          },
          orbitalTracksSource: {
            type: 'geojson',
            data: orbitalGeoJSON,
          },
        },
        layers: [
          // Background deep space
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': '#000401',
            },
          },
          // Dark Cyber SAR Basemap layer
          {
            id: 'dark-layer',
            type: 'raster',
            source: 'darkBasemap',
            paint: {
              'raster-opacity': 0.0,
              'raster-contrast': 0.2,
            },
          },
          // High-Resolution Photorealistic Satellite layer
          {
            id: 'satellite-layer',
            type: 'raster',
            source: 'esriSatellite',
            paint: {
              'raster-opacity': 1.0,
              'raster-contrast': 0.1,
              'raster-saturation': 0.05,
            },
          },
          // 3D Hillshading layer on elevation DEM
          {
            id: 'hillshade-layer',
            type: 'hillshade',
            source: 'terrainSource',
            paint: {
              'hillshade-shadow-color': '#001404',
              'hillshade-highlight-color': '#1fea00',
              'hillshade-accent-color': '#002f06',
              'hillshade-exaggeration': 0.7,
            },
          },
          // Glowing Neon Radar Orbital Tracks
          {
            id: 'orbital-tracks-glow',
            type: 'line',
            source: 'orbitalTracksSource',
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
            },
            paint: {
              'line-color': '#1fea00',
              'line-width': 4,
              'line-opacity': 0.25,
              'line-blur': 3,
            },
          },
          {
            id: 'orbital-tracks-line',
            type: 'line',
            source: 'orbitalTracksSource',
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
            },
            paint: {
              'line-color': '#1fea00',
              'line-width': 1.5,
              'line-opacity': 0.85,
              'line-dasharray': [4, 3],
            },
          },
        ],
        sky: {
          'sky-color': '#000802',
          'sky-horizon-blend': 0.4,
          'horizon-color': '#002f06',
          'horizon-fog-blend': 0.7,
          'fog-color': '#001404',
          'fog-ground-blend': 0.6,
        },
      },
      center: [initialLng, initialLat],
      zoom: 3.35,
      pitch: 36,
      bearing: -5,
      maxPitch: 85,
    });

    mapRef.current = map;

    // Set globe projection & terrain on load
    map.on('load', () => {
      try {
        map.setProjection({ type: 'globe' });
      } catch (e) {
        console.warn('Globe projection init:', e);
      }

      try {
        map.setTerrain({
          source: 'terrainSource',
          exaggeration: terrainExaggeration,
        });
      } catch (e) {
        console.warn('Terrain init:', e);
      }

      setIsMapLoaded(true);
    });

    // Pause auto-rotation when user interacts manually
    const onUserInteractionStart = () => {
      userInteractingRef.current = true;
      isSpinningRef.current = false;
      const center = map.getCenter();
      currentLngRef.current = center.lng;
      currentLatRef.current = center.lat;
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };

    const onUserInteractionEnd = () => {
      userInteractingRef.current = false;
      const center = map.getCenter();
      currentLngRef.current = center.lng;
      currentLatRef.current = center.lat;
      lastScrollProgressRef.current = scrollProgressRef.current;
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = setTimeout(() => {
        if (!userInteractingRef.current && isAutoSpin && viewMode === 'globe') {
          isSpinningRef.current = true;
        }
      }, 5000);
    };

    map.on('dragstart', onUserInteractionStart);
    map.on('rotatestart', onUserInteractionStart);
    map.on('pitchstart', onUserInteractionStart);
    map.on('zoomstart', onUserInteractionStart);

    map.on('dragend', onUserInteractionEnd);
    map.on('rotateend', onUserInteractionEnd);
    map.on('pitchend', onUserInteractionEnd);
    map.on('zoomend', onUserInteractionEnd);

    // Auto-spin & scroll-driven cinematic camera interpolation loop
    const spinGlobe = () => {
      const map = mapRef.current;
      if (map) {
        if (!userInteractingRef.current) {
          if (viewMode === 'globe') {
            const sp = scrollProgressRef.current;
            const mouse = mouseParallaxRef.current;

            // Multi-stage cinematic camera waypoints focused on India across page storytelling:
            // 0.00 - 0.42: Hero section -> Wide orbital planetary vantage centered on India & Indian Ocean
            // 0.42 - 0.80: "Built for Unpredictable Roads" -> Low-altitude 3D terrain skim revealing Ladakh & Himalayan mountain passes
            // 0.80 - 1.00: "Continuous Logistics Intelligence Across the Northeast" -> East & Northeast logistics corridor (Siliguri/Bengal)
            let targetPitch = 36;
            let targetZoom = 3.35;
            let targetBearing = -5;
            let targetLat = 22.5937;
            let targetLng = 78.9629;

            if (sp <= 0.42) {
              const t = sp / 0.42;
              const ease = 1 - Math.pow(1 - t, 3);
              targetPitch = 36 + ease * 28; // 36° -> 64°
              targetZoom = 3.35 + ease * 1.45; // 3.35 -> 4.80 (deep dive into Himalayan mountain passes)
              targetBearing = -5 + ease * 29; // -5° -> 24°
              targetLat = 22.5937 + ease * 11.2; // 22.59° -> 33.79° (Ladakh / Zoji La & high passes)
              targetLng = 78.9629 - ease * 2.8; // 78.96° -> 76.16° (Kashmir & Northern freight corridors)
            } else if (sp <= 0.80) {
              const t = (sp - 0.42) / 0.38;
              const ease = t * t * (3 - 2 * t);
              targetPitch = 64 - ease * 16; // 64° -> 48°
              targetZoom = 4.80 - ease * 0.40; // 4.80 -> 4.40
              targetBearing = 24 - ease * 36; // 24° -> -12°
              targetLat = 33.7937 - ease * 7.4; // 33.79° -> 26.39° (Northeast logistics corridor)
              targetLng = 76.1629 + ease * 12.2; // 76.16° -> 88.36° (Siliguri & Bengal transit hub)
            } else {
              const t = (sp - 0.80) / 0.20;
              const ease = t * t;
              targetPitch = 48 - ease * 12; // 48° -> 36°
              targetZoom = 4.40 - ease * 0.95; // 4.40 -> 3.45 (panoramic view of Indian subcontinent)
              targetBearing = -12 + ease * 7; // -12° -> -5°
              targetLat = 26.3937 - ease * 3.8; // 26.39° -> 22.59° (re-centering over Central India)
              targetLng = 88.3629 - ease * 9.4; // 88.36° -> 78.96°
            }

            // Organic ambient sway to give life without drifting away from India
            const time = performance.now() * 0.00035;
            const ambientLng = isSpinningRef.current ? Math.sin(time) * 1.5 : 0;
            const ambientBearing = isSpinningRef.current ? Math.cos(time * 0.7) * 2.5 : 0;

            // Mouse parallax integration
            targetPitch = Math.max(15, Math.min(80, targetPitch - mouse.y * 4));
            targetBearing += mouse.x * 5 + ambientBearing;
            targetLng += ambientLng;

            // Fluid exponential camera smoothing (60fps responsive 0.08 interpolation)
            currentPitchRef.current += (targetPitch - currentPitchRef.current) * 0.08;
            currentZoomRef.current += (targetZoom - currentZoomRef.current) * 0.08;
            currentBearingRef.current += (targetBearing - currentBearingRef.current) * 0.08;
            currentLatRef.current += (targetLat - currentLatRef.current) * 0.08;
            currentLngRef.current += (targetLng - currentLngRef.current) * 0.08;

            map.jumpTo({
              center: [currentLngRef.current, currentLatRef.current],
              pitch: currentPitchRef.current,
              zoom: currentZoomRef.current,
              bearing: currentBearingRef.current,
            });
          }
        } else {
          // Track map camera when user manually drags/rotates
          const center = map.getCenter();
          currentLngRef.current = center.lng;
          currentLatRef.current = center.lat;
          currentPitchRef.current = map.getPitch();
          currentZoomRef.current = map.getZoom();
          currentBearingRef.current = map.getBearing();
          lastScrollProgressRef.current = scrollProgressRef.current;
        }
      }
      animFrameRef.current = requestAnimationFrame(spinGlobe);
    };
    animFrameRef.current = requestAnimationFrame(spinGlobe);

    // Resize observer to ensure 100% sharp rendering
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Render Interactive Ground Markers on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    // Clear previous markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!activeLayers.groundMarkers) return;

    GEO_NODES.forEach((node) => {
      const isSelected = activeNode?.id === node.id;

      // Custom marker container
      const el = document.createElement('div');
      el.className = 'group cursor-pointer select-none';
      el.style.transform = 'translate(-50%, -50%)';

      el.innerHTML = `
        <div class="relative flex items-center justify-center pointer-events-auto">
          <!-- Outer Pulsing Radar Ring -->
          <div class="absolute w-8 h-8 rounded-full border border-[#1fea00]/60 ${
            isSelected ? 'bg-[#1fea00]/20 animate-ping' : 'group-hover:animate-ping'
          }"></div>
          <div class="absolute w-5 h-5 rounded-full border border-[#1fea00] opacity-80"></div>
          <!-- Inner Core Dot -->
          <div class="w-2.5 h-2.5 rounded-full ${
            isSelected
              ? 'bg-[#1fea00] shadow-[0_0_12px_#1fea00]'
              : 'bg-emerald-400 group-hover:bg-[#1fea00] shadow-[0_0_8px_rgba(31,234,0,0.5)]'
          }"></div>
          <!-- Futuristic Label Badge -->
          <div class="absolute left-6 top-1/2 -translate-y-1/2 whitespace-nowrap pointer-events-none transition-all duration-300 ${
            isSelected
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
          }">
            <div class="px-2.5 py-1 rounded-md bg-[#001f05]/90 border border-[#1fea00]/50 backdrop-blur-md text-[11px] font-mono shadow-[0_0_15px_rgba(0,47,6,0.8)]">
              <div class="text-[#1fea00] font-bold flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-[#1fea00]"></span>
                ${node.name}
              </div>
              <div class="text-neutral-300 text-[10px] flex items-center gap-2">
                <span>${node.elevation}</span>
                <span class="text-emerald-500">•</span>
                <span>${node.category}</span>
              </div>
            </div>
          </div>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectNode(node);
      });

      const marker = new Marker({ element: el, anchor: 'center' })
        .setLngLat([node.lng, node.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [isMapLoaded, activeNode, activeLayers.groundMarkers, onSelectNode]);

  // 3. React to Active Node & ViewMode Changes with Smooth 3D Flight
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    if (activeNode) {
      if (viewMode === 'terrain') {
        // Deep 3D Terrain Fly-In: High pitch, low altitude, dramatic angle on the mountain
        map.flyTo({
          center: [activeNode.lng, activeNode.lat],
          zoom: 13.0,
          pitch: 70,
          bearing: 45,
          speed: 1.1,
          curve: 1.4,
          essential: true,
        });
      } else {
        // Planetary / Regional Globe Fly-To: Moderate zoom, orbital perspective
        map.flyTo({
          center: [activeNode.lng, activeNode.lat],
          zoom: 5.2,
          pitch: 58,
          bearing: 15,
          speed: 1.0,
          curve: 1.3,
          essential: true,
        });
      }
    } else if (viewMode === 'globe') {
      map.flyTo({
        center: [78.9629, 22.5937],
        zoom: 3.35,
        pitch: 36,
        bearing: -5,
        speed: 0.9,
        essential: true,
      });
    }
  }, [activeNode, viewMode, isMapLoaded]);

  // 4. Update Map Style (Satellite vs. SAR Cyber Dark vs. Topo)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    try {
      if (mapStyle === 'satellite') {
        map.setPaintProperty('satellite-layer', 'raster-opacity', 1.0);
        map.setPaintProperty('dark-layer', 'raster-opacity', 0.0);
        map.setPaintProperty('hillshade-layer', 'hillshade-exaggeration', 0.6);
        map.setPaintProperty('hillshade-layer', 'hillshade-highlight-color', '#1fea00');
        map.setPaintProperty('hillshade-layer', 'hillshade-shadow-color', '#001404');
      } else if (mapStyle === 'radar') {
        // Dark Cyber InSAR with neon green contours & relief
        map.setPaintProperty('satellite-layer', 'raster-opacity', 0.15);
        map.setPaintProperty('dark-layer', 'raster-opacity', 0.9);
        map.setPaintProperty('hillshade-layer', 'hillshade-exaggeration', 1.0);
        map.setPaintProperty('hillshade-layer', 'hillshade-highlight-color', '#1fea00');
        map.setPaintProperty('hillshade-layer', 'hillshade-shadow-color', '#000802');
      } else if (mapStyle === 'topo') {
        // Pure 3D Topographic DEM
        map.setPaintProperty('satellite-layer', 'raster-opacity', 0.4);
        map.setPaintProperty('dark-layer', 'raster-opacity', 0.3);
        map.setPaintProperty('hillshade-layer', 'hillshade-exaggeration', 1.2);
        map.setPaintProperty('hillshade-layer', 'hillshade-highlight-color', '#52ff38');
        map.setPaintProperty('hillshade-layer', 'hillshade-shadow-color', '#001b05');
      }
    } catch (err) {
      console.warn('Map style update error:', err);
    }
  }, [mapStyle, isMapLoaded]);

  // 5. Update Terrain 3D Exaggeration
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    try {
      if (activeLayers.terrainDem) {
        map.setTerrain({
          source: 'terrainSource',
          exaggeration: terrainExaggeration,
        });
      } else {
        map.setTerrain(null as any);
      }
    } catch (err) {
      console.warn('Terrain exaggeration error:', err);
    }
  }, [terrainExaggeration, activeLayers.terrainDem, isMapLoaded]);

  // 6. Update Layer Visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    try {
      map.setLayoutProperty(
        'satellite-layer',
        'visibility',
        activeLayers.satelliteImagery ? 'visible' : 'none'
      );
      map.setLayoutProperty(
        'hillshade-layer',
        'visibility',
        activeLayers.hillshadeMesh ? 'visible' : 'none'
      );
      map.setLayoutProperty(
        'orbital-tracks-line',
        'visibility',
        activeLayers.orbitalTracks ? 'visible' : 'none'
      );
      map.setLayoutProperty(
        'orbital-tracks-glow',
        'visibility',
        activeLayers.orbitalTracks ? 'visible' : 'none'
      );
    } catch (err) {
      console.warn('Layer visibility error:', err);
    }
  }, [activeLayers, isMapLoaded]);

  return (
    <>
      {/* Real 3D Map Container */}
      <div
        id="real-3d-map-wrapper"
        className="fixed inset-0 w-full h-full z-0 overflow-hidden"
      >
        <div
          ref={mapContainerRef}
          id="maplibre-3d-canvas"
          className="w-full h-full relative cursor-grab active:cursor-grabbing outline-none"
        />

        {/* Ambient Vignette & Emerald Horizon Overlay */}
        <div className="absolute inset-0 pointer-events-none z-[1] bg-radial from-transparent via-[#000000]/30 to-[#000000]/80" />
      </div>
    </>
  );
};
