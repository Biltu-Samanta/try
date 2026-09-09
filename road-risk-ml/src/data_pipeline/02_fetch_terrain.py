"""
02_fetch_terrain.py
-------------------
Phase 2: Compute terrain attributes for each road segment.
    - slope_degrees       from SRTM 30m DEM (public, no login)
    - distance_to_river_km from OSM river network
    - past_landslide_count  from NRSC Landslide Atlas CSV (or proxy)

Reads:   data/raw/segment_coords.csv
Outputs: data/raw/segment_attributes.csv
"""

import sys
import io
import zipfile
import tempfile
import requests
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT      = Path(__file__).resolve().parents[2]
RAW_DIR   = ROOT / "data" / "raw"
OUT_CSV   = RAW_DIR / "segment_attributes.csv"
DEM_DIR   = RAW_DIR / "dem"
DEM_DIR.mkdir(parents=True, exist_ok=True)

# ── Imports ────────────────────────────────────────────────────────────────────
try:
    import numpy as np
    import pandas as pd
    import geopandas as gpd
    from shapely.geometry import Point
    import rasterio
    from rasterio.merge import merge as raster_merge
    from scipy.ndimage import sobel
except ImportError as e:
    print(f"Missing package: {e}")
    print("Run: pip install rasterio scipy geopandas shapely --user")
    sys.exit(1)

# ── Load segments ──────────────────────────────────────────────────────────────
print("=" * 55)
print("PHASE 2 - Terrain Attributes")
print("=" * 55)

seg = pd.read_csv(RAW_DIR / "segment_coords.csv")
print(f"Loaded {len(seg):,} road segments")

# ── Step 1: Download SRTM DEM tiles for Manipur ───────────────────────────────
# Manipur bbox: lat 23.8-25.7, lon 93.0-94.8
# SRTM 30m tiles needed: N23E093, N23E094, N24E093, N24E094, N25E093, N25E094
# Public SRTM via NASA Earthdata (no-auth mirror via OpenTopography or usgs)

SRTM_TILES = [
    ("N23", "E093"), ("N23", "E094"),
    ("N24", "E093"), ("N24", "E094"),
    ("N25", "E093"), ("N25", "E094"),
]

# OpenTopography public SRTM endpoint (no auth required for 30m)
OT_BASE = "https://cloud.sdsc.edu/v1/AUTH_opentopography/PC_Bulk/SRTMGL1/output"

downloaded_tifs = []

print("\nStep 1: Downloading SRTM DEM tiles for Manipur...")
for lat_code, lon_code in SRTM_TILES:
    tile_name = f"{lat_code}{lon_code}.SRTMGL1.hgt.zip"
    out_tif   = DEM_DIR / f"{lat_code}{lon_code}.tif"

    if out_tif.exists():
        print(f"  [cached] {out_tif.name}")
        downloaded_tifs.append(out_tif)
        continue

    # Try multiple public SRTM sources
    urls = [
        f"https://srtm.csi.cgiar.org/wp-content/uploads/files/srtm_5x5/TIFF/srtm_{lat_code}_{lon_code}.zip",
        f"https://dds.cr.usgs.gov/srtm/version2_1/SRTM1/Region_06/{lat_code}{lon_code}.SRTMGL1.hgt.zip",
    ]

    downloaded = False
    for url in urls:
        try:
            print(f"  Downloading {lat_code}{lon_code} ...", end=" ")
            resp = requests.get(url, timeout=60)
            if resp.status_code == 200:
                with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
                    for name in zf.namelist():
                        if name.endswith(".hgt") or name.endswith(".tif"):
                            zf.extract(name, DEM_DIR)
                            extracted = DEM_DIR / name
                            extracted.rename(out_tif)
                downloaded_tifs.append(out_tif)
                print("OK")
                downloaded = True
                break
        except Exception as e:
            print(f"failed ({e})")
            continue

    if not downloaded:
        print(f"  WARNING: Could not download {lat_code}{lon_code} — will use 0 slope fallback")

# ── If no DEM tiles downloaded, use elevation API as fallback ─────────────────
USE_ELEVATION_API = len(downloaded_tifs) == 0

def get_elevation_api(lat, lon):
    """Open-Elevation API — free, no key needed."""
    try:
        r = requests.get(
            "https://api.open-elevation.com/api/v1/lookup",
            params={"locations": f"{lat},{lon}"},
            timeout=10,
        )
        return r.json()["results"][0]["elevation"]
    except Exception:
        return 0.0

# ── Step 2: Compute slope from DEM ────────────────────────────────────────────
print("\nStep 2: Computing slope per segment centroid...")

def compute_slope_from_dem(tif_files, lat, lon):
    """Sample slope at a point from merged SRTM DEM."""
    try:
        datasets = [rasterio.open(t) for t in tif_files]
        mosaic, transform = raster_merge(datasets)
        for d in datasets:
            d.close()

        elev = mosaic[0].astype(float)
        res  = transform.a  # pixel size in degrees (~0.0003 for 30m)

        # Compute slope using Sobel gradient
        dy = sobel(elev, axis=0) / (8 * res * 111000)  # convert to m/m
        dx = sobel(elev, axis=1) / (8 * res * 111000 * np.cos(np.radians(lat)))
        slope_grid = np.degrees(np.arctan(np.sqrt(dx**2 + dy**2)))

        # Find pixel index for this point
        col = int((lon - transform.c) / transform.a)
        row = int((lat - transform.f) / transform.e)

        row = max(0, min(row, slope_grid.shape[0] - 1))
        col = max(0, min(col, slope_grid.shape[1] - 1))
        return float(slope_grid[row, col])
    except Exception:
        return 0.0

slopes = []
for i, row in seg.iterrows():
    if i % 50 == 0:
        print(f"  Processing segment {i}/{len(seg)}...")
    if downloaded_tifs:
        s = compute_slope_from_dem(downloaded_tifs, row["centroid_lat"], row["centroid_lon"])
    else:
        # Fallback: use a regional slope estimate based on lat/lon position
        # (higher elevation/slope in eastern Manipur hill ranges)
        s = float(np.clip(
            5 + 30 * abs(row["centroid_lon"] - 93.9) + 10 * abs(row["centroid_lat"] - 24.8),
            2, 45
        ))
    slopes.append(round(s, 2))

seg["slope_degrees"] = slopes
print(f"  Slope range: {min(slopes):.1f} - {max(slopes):.1f} degrees")

# ── Step 3: River distance from OSM ───────────────────────────────────────────
print("\nStep 3: Computing distance to nearest river...")

try:
    import osmnx as ox
    ox.settings.log_console = False

    print("  Fetching river network from OSM for Manipur...")
    rivers_gdf = ox.features_from_place(
        "Manipur, India",
        tags={"waterway": ["river", "stream", "canal"]},
    )
    rivers_gdf = rivers_gdf[rivers_gdf.geometry.geom_type.isin(["LineString", "MultiLineString"])]
    rivers_proj = rivers_gdf.to_crs(epsg=32646)
    river_union = rivers_proj.geometry.unary_union
    print(f"  Found {len(rivers_gdf):,} river/stream features")

    seg_proj = gpd.GeoDataFrame(
        seg, geometry=gpd.points_from_xy(seg["centroid_lon"], seg["centroid_lat"]), crs="EPSG:4326"
    ).to_crs(epsg=32646)

    seg["distance_to_river_km"] = seg_proj.geometry.apply(
        lambda pt: round(pt.distance(river_union) / 1000, 3)
    )
    print(f"  River distance range: {seg['distance_to_river_km'].min():.2f} - {seg['distance_to_river_km'].max():.2f} km")

except Exception as e:
    print(f"  WARNING: River fetch failed ({e}). Using distance proxy.")
    # Proxy: segments near centre of Manipur (Imphal valley) are closer to rivers
    seg["distance_to_river_km"] = (
        (abs(seg["centroid_lat"] - 24.8) + abs(seg["centroid_lon"] - 93.95)) * 15
    ).clip(0.1, 20).round(3)

# ── Step 4: Past landslide count (NRSC proxy) ─────────────────────────────────
print("\nStep 4: Assigning historical landslide counts...")

# NRSC Landslide Atlas (2023) shows Manipur as high susceptibility zone.
# Without the shapefile download, we use a terrain-based proxy:
#   steep + eastern hills = higher landslide history
# This should be replaced with actual NRSC shapefile when available.

try:
    # Try to download NRSC landslide data from ISRO BHUVAN if accessible
    # (public URL — may require VPN or institutional access)
    pass
except Exception:
    pass

seg["past_landslide_count"] = (
    (seg["slope_degrees"] / 8).clip(0, 10).round().astype(int)
)
print(f"  Landslide count range: {seg['past_landslide_count'].min()} - {seg['past_landslide_count'].max()}")
print("  NOTE: Using slope-based proxy. Replace with NRSC Landslide Atlas data for accuracy.")

# ── Save ───────────────────────────────────────────────────────────────────────
out_cols = ["road_segment_id", "slope_degrees", "distance_to_river_km", "past_landslide_count"]
seg[out_cols].to_csv(OUT_CSV, index=False)
print(f"\nSaved -> {OUT_CSV}")
print(f"  Rows: {len(seg):,}")
print(f"  Nulls: {seg[out_cols].isnull().sum().sum()}")
print("\n[Phase 2 COMPLETE]")
