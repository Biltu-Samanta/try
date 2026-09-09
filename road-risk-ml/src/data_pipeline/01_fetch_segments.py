"""
01_fetch_segments.py
--------------------
Phase 1: Fetch road network for Manipur state from OpenStreetMap.

Strategy (in order of preference):
  A. osmnx bbox query with fast Overpass endpoint (30s timeout)
  B. Direct Overpass API HTTP query
  C. Realistic synthetic Manipur segment fallback (always works)

Outputs: data/raw/segment_coords.csv
         data/raw/road_segments.geojson  (if GIS query succeeds)
"""

import sys
import time
import requests
from pathlib import Path

ROOT    = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)
OUT_CSV     = RAW_DIR / "segment_coords.csv"
OUT_GEOJSON = RAW_DIR / "road_segments.geojson"

try:
    import pandas as pd
    import numpy as np
except ImportError as e:
    print(f"Missing: {e}"); sys.exit(1)

# Manipur bounding box (WGS84): south, west, north, east
BBOX = (23.83, 93.03, 25.68, 94.78)   # lat_min, lon_min, lat_max, lon_max

RELEVANT_TAGS = ["trunk","trunk_link","primary","primary_link",
                 "secondary","secondary_link","tertiary","tertiary_link",
                 "unclassified","road"]

print("=" * 55)
print("PHASE 1 - Road Segments (Manipur, India)")
print("=" * 55)

# ══════════════════════════════════════════════════════════
# Strategy A: osmnx with fast endpoint & short timeout
# ══════════════════════════════════════════════════════════
def try_osmnx():
    try:
        import osmnx as ox
        import geopandas as gpd

        # Use faster Overpass endpoint
        ox.settings.overpass_endpoint = "https://overpass-api.de/api/interpreter"
        ox.settings.timeout = 60
        ox.settings.log_console = False
        ox.settings.cache_folder = str(RAW_DIR / "osm_cache")

        print("Strategy A: osmnx bbox query...")
        south, west, north, east = BBOX
        G = ox.graph_from_bbox(
            bbox=(north, south, east, west),
            network_type="drive",
            retain_all=False,
            truncate_by_edge=True,
        )
        print(f"  Graph: {len(G.nodes):,} nodes, {len(G.edges):,} edges")

        edges = ox.graph_to_gdfs(G, nodes=False).reset_index()

        # Normalise highway column
        if "highway" in edges.columns:
            edges["highway_type"] = edges["highway"].apply(
                lambda h: (h[0] if isinstance(h, list) else h) if pd.notna(h) else "road"
            )
            edges = edges[edges["highway_type"].isin(RELEVANT_TAGS)].copy()
        else:
            edges["highway_type"] = "road"

        edges = edges.reset_index(drop=True)
        edges["road_segment_id"] = ["SEG" + str(i).zfill(4) for i in range(len(edges))]

        edges_proj = edges.to_crs(epsg=32646)
        edges["length_m"] = edges_proj.geometry.length.round(1)

        centroids = edges.geometry.centroid
        edges["centroid_lon"] = centroids.x.round(6)
        edges["centroid_lat"] = centroids.y.round(6)

        edges["road_name"] = edges.get("name", pd.Series(["Unknown"] * len(edges))).apply(
            lambda n: (n[0] if isinstance(n, list) else n) if pd.notna(n) else "Unknown"
        )

        out_cols = ["road_segment_id","centroid_lat","centroid_lon","road_name","highway_type","length_m"]
        result = edges[out_cols].drop_duplicates(subset=["road_segment_id"])

        # Save GeoJSON
        edges[out_cols + ["geometry"]].to_file(OUT_GEOJSON, driver="GeoJSON")
        return result

    except Exception as e:
        print(f"  Strategy A failed: {e}")
        return None


# ══════════════════════════════════════════════════════════
# Strategy B: Direct Overpass HTTP (lightweight query)
# ══════════════════════════════════════════════════════════
def try_overpass():
    print("Strategy B: Direct Overpass HTTP query...")
    south, west, north, east = BBOX
    bbox_str = f"{south},{west},{north},{east}"

    query = f"""
    [out:json][timeout:60];
    (
      way["highway"~"^(trunk|primary|secondary|tertiary|unclassified)"]["highway"!~"link$"]({bbox_str});
    );
    out geom;
    """
    endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    ]
    for url in endpoints:
        try:
            print(f"  Trying {url.split('/')[2]}...")
            resp = requests.post(url, data={"data": query}, timeout=90)
            resp.raise_for_status()
            elements = resp.json().get("elements", [])
            print(f"  Got {len(elements):,} way elements")

            if not elements:
                continue

            records = []
            for i, el in enumerate(elements):
                if el.get("type") != "way" or not el.get("geometry"):
                    continue
                coords = el["geometry"]
                if len(coords) < 2:
                    continue
                mid = coords[len(coords) // 2]
                tags = el.get("tags", {})
                records.append({
                    "road_segment_id": f"SEG{i:04d}",
                    "centroid_lat":    round(mid["lat"], 6),
                    "centroid_lon":    round(mid["lon"], 6),
                    "road_name":       tags.get("name", "Unknown"),
                    "highway_type":    tags.get("highway", "road"),
                    "length_m":        round(len(coords) * 10.0, 1),  # rough estimate
                })

            if records:
                return pd.DataFrame(records)

        except Exception as e:
            print(f"  {url.split('/')[2]} failed: {e}")
            continue

    return None


# ══════════════════════════════════════════════════════════
# Strategy C: Realistic Manipur synthetic fallback
# ══════════════════════════════════════════════════════════
def make_synthetic_manipur():
    print("Strategy C: Generating realistic Manipur road segment proxies...")

    rng = np.random.default_rng(42)

    # Real key roads / corridors in Manipur with approximate coordinates
    corridors = [
        # (name, highway_type, start_lat, start_lon, end_lat, end_lon, n_segments)
        ("NH-2 (Imphal-Jiribam)",     "national_highway", 24.82, 93.94, 24.68, 93.12, 15),
        ("NH-37 (Imphal-Moreh)",      "national_highway", 24.82, 93.94, 24.24, 94.27, 12),
        ("NH-102 (Imphal-Ukhrul)",    "national_highway", 24.82, 93.94, 25.13, 94.36,  8),
        ("NH-150 (Imphal-Senapati)",  "national_highway", 24.82, 93.94, 25.27, 93.97,  6),
        ("Imphal-Churachandpur Rd",   "primary",          24.82, 93.94, 24.33, 93.68,  8),
        ("Imphal-Bishnupur Rd",       "primary",          24.82, 93.94, 24.62, 93.76,  5),
        ("Thoubal Rd",                "primary",          24.82, 93.94, 24.67, 93.99,  4),
        ("Kakching Rd",               "secondary",        24.67, 93.99, 24.49, 94.01,  4),
        ("Chandel Rd",                "secondary",        24.33, 93.68, 24.06, 94.02,  5),
        ("Tamenglong Rd",             "secondary",        24.82, 93.94, 24.98, 93.41,  6),
        ("Noney Rd",                  "secondary",        24.82, 93.94, 24.78, 93.54,  4),
        ("Kangpokpi Rd",              "secondary",        25.27, 93.97, 25.39, 93.86,  3),
        ("Pherzawl Rd",               "tertiary",         24.33, 93.68, 24.18, 93.49,  4),
        ("Khengjoi Rd",               "tertiary",         24.98, 93.41, 25.14, 93.27,  3),
        ("Kamjong Rd",                "tertiary",         25.13, 94.36, 25.32, 94.58,  3),
        ("BRO Road 1 (Hill)",         "unclassified",     24.50, 93.50, 24.30, 93.30,  4),
        ("BRO Road 2 (Hill)",         "unclassified",     25.00, 94.10, 25.20, 94.30,  3),
        ("BRO Road 3 (Tengnoupal)",   "unclassified",     24.24, 94.27, 24.10, 94.45,  3),
    ]

    records = []
    seg_idx = 0
    for (name, hw_type, s_lat, s_lon, e_lat, e_lon, n_seg) in corridors:
        for k in range(n_seg):
            t = (k + 0.5) / n_seg
            lat = s_lat + t * (e_lat - s_lat) + rng.normal(0, 0.005)
            lon = s_lon + t * (e_lon - s_lon) + rng.normal(0, 0.005)
            lat = float(np.clip(lat, BBOX[0], BBOX[2]))
            lon = float(np.clip(lon, BBOX[1], BBOX[3]))
            seg_len = rng.uniform(800, 5000)
            records.append({
                "road_segment_id": f"SEG{seg_idx:04d}",
                "centroid_lat":    round(lat, 6),
                "centroid_lon":    round(lon, 6),
                "road_name":       name,
                "highway_type":    hw_type,
                "length_m":        round(seg_len, 1),
            })
            seg_idx += 1

    df = pd.DataFrame(records)
    print(f"  Generated {len(df)} realistic Manipur road segments")
    print("  NOTE: Replace with real OSM data when network allows (re-run script)")
    return df


# ══════════════════════════════════════════════════════════
# Execute strategies in order
# ══════════════════════════════════════════════════════════
segments = None

segments = try_osmnx()

if segments is None or len(segments) == 0:
    segments = try_overpass()

if segments is None or len(segments) == 0:
    segments = make_synthetic_manipur()

# ── Save ───────────────────────────────────────────────────────────────────────
segments = segments.reset_index(drop=True)
segments.to_csv(OUT_CSV, index=False)

print(f"\nSaved {len(segments):,} segments -> {OUT_CSV}")
print("\n=== Segment Summary ===")
print(f"  Total segments : {len(segments):,}")
print(f"  Lat range      : {segments['centroid_lat'].min():.4f} - {segments['centroid_lat'].max():.4f}")
print(f"  Lon range      : {segments['centroid_lon'].min():.4f} - {segments['centroid_lon'].max():.4f}")
print(f"  Avg length (m) : {segments['length_m'].mean():.0f}")
print(f"\n  Highway type breakdown:")
print(segments["highway_type"].value_counts().to_string())
print("\n[Phase 1 COMPLETE]")
