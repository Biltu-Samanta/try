"""
04_fetch_labels.py
------------------
Phase 4: Collect road_blocked (0/1) ground-truth labels from:
    A. data.gov.in  — road closure / landslide CSV datasets
    B. NHAI         — National Highway incident data for Manipur

Since both portals require manual download (no public bulk API),
this script:
  1. Scans data/raw/labels_input/ for any CSV files you have placed there
  2. Attempts to auto-parse common column patterns from NHAI/data.gov.in exports
  3. Falls back to a terrain-informed heuristic so the pipeline never halts

HOW TO ADD REAL LABEL DATA:
  - Download road blockage / closure CSVs from:
      https://data.gov.in/search?title=road+blockage
      https://data.gov.in/search?title=landslide
      NHAI helpline data (RTI or portal download)
  - Place the downloaded CSV files in:  data/raw/labels_input/
  - Re-run this script — it will auto-parse and merge them

Reads:   data/raw/segment_coords.csv
         data/raw/labels_input/*.csv   (optional — your downloaded files)
Outputs: data/raw/road_incidents.csv
"""

import sys
import re
from pathlib import Path

ROOT       = Path(__file__).resolve().parents[2]
RAW_DIR    = ROOT / "data" / "raw"
LABELS_DIR = RAW_DIR / "labels_input"
LABELS_DIR.mkdir(parents=True, exist_ok=True)
OUT_CSV    = RAW_DIR / "road_incidents.csv"

try:
    import pandas as pd
    import numpy as np
    from shapely.geometry import Point
    import geopandas as gpd
except ImportError as e:
    print(f"Missing package: {e}")
    sys.exit(1)

print("=" * 55)
print("PHASE 4 - Road Blocked Labels")
print("=" * 55)

seg = pd.read_csv(RAW_DIR / "segment_coords.csv")
print(f"Loaded {len(seg):,} segments")

# ── Helper: find nearest segment to a lat/lon point ───────────────────────────
seg_gdf = gpd.GeoDataFrame(
    seg,
    geometry=gpd.points_from_xy(seg["centroid_lon"], seg["centroid_lat"]),
    crs="EPSG:4326"
).to_crs(epsg=32646)

def nearest_segment(lat, lon, max_dist_m=5000):
    """Return road_segment_id of the closest segment within max_dist_m."""
    pt = gpd.GeoDataFrame(
        [{"geometry": Point(lon, lat)}], crs="EPSG:4326"
    ).to_crs(epsg=32646).geometry.iloc[0]
    dists = seg_gdf.geometry.distance(pt)
    idx   = dists.idxmin()
    if dists[idx] <= max_dist_m:
        return seg.loc[idx, "road_segment_id"]
    return None

# ── Source A: Scan labels_input/ for user-placed CSVs ─────────────────────────
user_incidents = []
csv_files = list(LABELS_DIR.glob("*.csv"))

if csv_files:
    print(f"\nFound {len(csv_files)} user-provided CSV(s) in labels_input/")

    # Common column name patterns from data.gov.in and NHAI exports
    DATE_COLS     = ["date", "incident_date", "closure_date", "Date", "DATE", "Report_Date"]
    LAT_COLS      = ["latitude", "lat", "Latitude", "LAT", "y"]
    LON_COLS      = ["longitude", "lon", "long", "Longitude", "LON", "x"]
    BLOCKED_COLS  = ["road_blocked", "blocked", "closure", "status", "Status"]
    ROAD_COLS     = ["road_name", "highway", "road", "location", "Location"]

    for csv_path in csv_files:
        print(f"  Parsing: {csv_path.name}")
        try:
            raw = pd.read_csv(csv_path, encoding="utf-8", errors="replace")
            raw.columns = raw.columns.str.strip()

            # Find date column
            date_col = next((c for c in DATE_COLS if c in raw.columns), None)
            lat_col  = next((c for c in LAT_COLS  if c in raw.columns), None)
            lon_col  = next((c for c in LON_COLS  if c in raw.columns), None)

            if not date_col:
                print(f"    WARNING: No recognisable date column — skipping {csv_path.name}")
                continue

            raw[date_col] = pd.to_datetime(raw[date_col], errors="coerce")
            raw = raw.dropna(subset=[date_col])
            raw = raw[
                (raw[date_col] >= "2024-01-01") &
                (raw[date_col] <= "2025-12-31")
            ]

            if lat_col and lon_col:
                # Geo-match to nearest segment
                for _, r in raw.iterrows():
                    try:
                        seg_id = nearest_segment(float(r[lat_col]), float(r[lon_col]))
                        if seg_id:
                            user_incidents.append({
                                "date":            r[date_col].strftime("%Y-%m-%d"),
                                "road_segment_id": seg_id,
                                "road_blocked":    1,
                            })
                    except Exception:
                        pass
            else:
                # No lat/lon — mark incidents on all segments for that date (conservative)
                for _, r in raw.iterrows():
                    user_incidents.append({
                        "date":            r[date_col].strftime("%Y-%m-%d"),
                        "road_segment_id": None,   # will be dropped
                        "road_blocked":    1,
                    })

            print(f"    Parsed {len(raw)} records from {csv_path.name}")

        except Exception as e:
            print(f"    ERROR parsing {csv_path.name}: {e}")

else:
    print(f"\nNo CSVs found in {LABELS_DIR}")
    print("Place downloaded data.gov.in / NHAI CSV files there and rerun.")

# ── Source B: Terrain-informed heuristic (always runs as baseline) ────────────
print("\nGenerating terrain-informed baseline labels...")

rainfall_path = RAW_DIR / "rainfall_raw.csv"
attrs_path    = RAW_DIR / "segment_attributes.csv"

if not rainfall_path.exists() or not attrs_path.exists():
    print("ERROR: Run phases 2 and 3 first (rainfall + attributes must exist).")
    sys.exit(1)

rainfall = pd.read_csv(rainfall_path, parse_dates=["date"])
attrs    = pd.read_csv(attrs_path)

df = rainfall.merge(attrs, on="road_segment_id", how="left")
df = df.sort_values(["road_segment_id", "date"])

# Compute 3-day rolling rainfall
df["rain3"] = df.groupby("road_segment_id")["rainfall_mm"].transform(
    lambda x: x.rolling(3, min_periods=1).sum()
)

# Season
def to_season(m):
    if m in (6,7,8,9):  return "monsoon"
    if m in (12,1,2):   return "winter"
    return "summer"
df["season"] = df["date"].dt.month.map(to_season)

# Logistic risk score matching synthetic generator
logit = (
    -4.5
    + 0.07  * df["rainfall_mm"]
    + 0.04  * df["rain3"]
    + 0.08  * df["slope_degrees"].fillna(10)
    - 0.12  * df["distance_to_river_km"].fillna(10)
    + 0.20  * df["past_landslide_count"].fillna(2)
    + df["season"].map({"monsoon": 1.5, "summer": 0.3, "winter": -0.5})
)
prob = 1 / (1 + np.exp(-logit))

rng = np.random.default_rng(42)
df["road_blocked"] = (rng.random(len(df)) < prob).astype(int)

heuristic_incidents = df[df["road_blocked"] == 1][
    ["date", "road_segment_id", "road_blocked"]
].copy()
heuristic_incidents["date"] = heuristic_incidents["date"].dt.strftime("%Y-%m-%d")

print(f"  Heuristic labels: {len(heuristic_incidents):,} blocked events")
print(f"  Blocked rate    : {len(heuristic_incidents)/len(df):.3f}")

# ── Merge user labels (override heuristic where real data exists) ──────────────
final_df = heuristic_incidents.copy()

if user_incidents:
    user_df = pd.DataFrame(user_incidents).dropna(subset=["road_segment_id"])
    print(f"\nMerging {len(user_df):,} real incident records (override heuristic)...")
    # Mark those specific segment-date combos as blocked=1 regardless of heuristic
    final_df = pd.concat([final_df, user_df]).drop_duplicates(
        subset=["date", "road_segment_id"], keep="last"
    )

final_df = final_df.sort_values(["date", "road_segment_id"])
final_df.to_csv(OUT_CSV, index=False)

print(f"\nSaved -> {OUT_CSV}")
print(f"  Total blocked events: {len(final_df):,}")
print(f"  Segments with events: {final_df['road_segment_id'].nunique()}")
print(f"  Date range: {final_df['date'].min()} to {final_df['date'].max()}")

print("\n[Phase 4 COMPLETE]")
print("\nTo improve label accuracy:")
print(f"  1. Download road closure CSVs from https://data.gov.in")
print(f"  2. Place them in: {LABELS_DIR}")
print(f"  3. Re-run this script")
