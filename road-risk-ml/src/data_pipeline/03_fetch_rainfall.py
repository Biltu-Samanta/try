"""
03_fetch_rainfall.py
--------------------
Phase 3: Fetch historical daily rainfall for each road segment centroid
         using the Open-Meteo Archive API (free, no API key required).

Date range: 2024-01-01 to 2025-12-31
API docs:   https://open-meteo.com/en/docs/historical-weather-api

Reads:   data/raw/segment_coords.csv
Outputs: data/raw/rainfall_raw.csv

Columns:
    date             - YYYY-MM-DD
    road_segment_id  - matches 01_fetch_segments output
    rainfall_mm      - daily precipitation sum in mm
"""

import sys
import time
from pathlib import Path

ROOT    = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
OUT_CSV = RAW_DIR / "rainfall_raw.csv"

try:
    import requests
    import pandas as pd
    import numpy as np
except ImportError as e:
    print(f"Missing package: {e}")
    sys.exit(1)

# ── Config ─────────────────────────────────────────────────────────────────────
START_DATE = "2024-01-01"
END_DATE   = "2025-12-31"
API_URL    = "https://archive-api.open-meteo.com/v1/archive"
DELAY_SEC  = 0.15   # polite delay between requests

# ── Load segments ──────────────────────────────────────────────────────────────
print("=" * 55)
print("PHASE 3 - Daily Rainfall (Open-Meteo)")
print("=" * 55)

seg = pd.read_csv(RAW_DIR / "segment_coords.csv")
print(f"Fetching rainfall for {len(seg):,} segments")
print(f"Date range: {START_DATE} to {END_DATE}\n")

# ── Fetch ──────────────────────────────────────────────────────────────────────
all_records = []
failed      = []

for idx, row in seg.iterrows():
    seg_id = row["road_segment_id"]
    lat    = round(float(row["centroid_lat"]), 4)
    lon    = round(float(row["centroid_lon"]), 4)

    if idx % 25 == 0:
        print(f"  [{idx}/{len(seg)}] Fetching {seg_id} ({lat}, {lon})...")

    params = {
        "latitude":          lat,
        "longitude":         lon,
        "start_date":        START_DATE,
        "end_date":          END_DATE,
        "daily":             "precipitation_sum",
        "timezone":          "Asia/Kolkata",
        "precipitation_unit": "mm",
    }

    try:
        resp = requests.get(API_URL, params=params, timeout=30)
        resp.raise_for_status()
        daily = resp.json()["daily"]

        for date, rain in zip(daily["time"], daily["precipitation_sum"]):
            all_records.append({
                "date":             date,
                "road_segment_id":  seg_id,
                "rainfall_mm":      round(float(rain or 0.0), 2),
            })

    except Exception as e:
        print(f"  WARNING: Failed {seg_id} — {e}")
        failed.append(seg_id)
        # Fill with zeros so dataset stays complete
        dates = pd.date_range(START_DATE, END_DATE, freq="D")
        for d in dates:
            all_records.append({
                "date":             d.strftime("%Y-%m-%d"),
                "road_segment_id":  seg_id,
                "rainfall_mm":      0.0,
            })

    time.sleep(DELAY_SEC)

# ── Save ───────────────────────────────────────────────────────────────────────
df = pd.DataFrame(all_records)
df["date"] = pd.to_datetime(df["date"])
df = df.sort_values(["road_segment_id", "date"])
df.to_csv(OUT_CSV, index=False)

print(f"\nSaved -> {OUT_CSV}")
print(f"  Total rows  : {len(df):,}")
print(f"  Segments    : {df['road_segment_id'].nunique()}")
print(f"  Date range  : {df['date'].min().date()} to {df['date'].max().date()}")
print(f"  Avg rainfall: {df['rainfall_mm'].mean():.2f} mm/day")

# ── Sanity check: verify monsoon spike ────────────────────────────────────────
print("\n  Monthly rainfall profile (all segments avg):")
monthly = df.groupby(df["date"].dt.month)["rainfall_mm"].mean()
for m, val in monthly.items():
    bar = "#" * int(val / 2)
    print(f"    Month {m:2d}: {val:6.2f} mm  {bar}")

if failed:
    print(f"\n  WARNING: {len(failed)} segments failed — filled with 0. Rerun to retry.")

print("\n[Phase 3 COMPLETE]")
