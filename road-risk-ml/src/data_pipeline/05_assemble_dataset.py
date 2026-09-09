"""
05_assemble_dataset.py
----------------------
Phase 5: Merge all raw data into the final model-ready dataset.

Reads:
    data/raw/rainfall_raw.csv        (Phase 3)
    data/raw/segment_attributes.csv  (Phase 2)
    data/raw/road_incidents.csv      (Phase 4)

Outputs:
    data/data.csv                    (replaces synthetic data — fed to train_model.py)
"""

import sys
from pathlib import Path

ROOT    = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
OUT_CSV = ROOT / "data" / "data.csv"

try:
    import pandas as pd
    import numpy as np
except ImportError as e:
    print(f"Missing package: {e}")
    sys.exit(1)

print("=" * 55)
print("PHASE 5 - Assembling Final Dataset")
print("=" * 55)

# ── Load all raw files ─────────────────────────────────────────────────────────
required = {
    "rainfall":  RAW_DIR / "rainfall_raw.csv",
    "attrs":     RAW_DIR / "segment_attributes.csv",
    "incidents": RAW_DIR / "road_incidents.csv",
}

for name, path in required.items():
    if not path.exists():
        print(f"ERROR: {path} not found. Run phases 1-4 first.")
        sys.exit(1)

rainfall  = pd.read_csv(required["rainfall"],  parse_dates=["date"])
attrs     = pd.read_csv(required["attrs"])
incidents = pd.read_csv(required["incidents"])

print(f"Loaded rainfall   : {len(rainfall):,} rows")
print(f"Loaded attrs      : {len(attrs):,} segments")
print(f"Loaded incidents  : {len(incidents):,} blocked events")

# ── Step 1: Merge rainfall + segment attributes ────────────────────────────────
df = rainfall.merge(attrs, on="road_segment_id", how="left")
print(f"\nAfter merging attrs : {len(df):,} rows")

# ── Step 2: Compute rainfall_last_3_days (rolling sum per segment) ─────────────
df = df.sort_values(["road_segment_id", "date"])
df["rainfall_last_3_days"] = (
    df.groupby("road_segment_id")["rainfall_mm"]
    .transform(lambda x: x.rolling(3, min_periods=1).sum())
    .round(2)
)

# ── Step 3: Derive season ──────────────────────────────────────────────────────
def to_season(m):
    if m in (6, 7, 8, 9):  return "monsoon"
    if m in (12, 1, 2):    return "winter"
    return "summer"

df["season"] = df["date"].dt.month.map(to_season)

# ── Step 4: Attach road_blocked labels ────────────────────────────────────────
incidents["date"] = pd.to_datetime(incidents["date"])

df = df.merge(
    incidents[["date", "road_segment_id", "road_blocked"]],
    on=["date", "road_segment_id"],
    how="left"
)
df["road_blocked"] = df["road_blocked"].fillna(0).astype(int)

# ── Step 5: Format date as string ─────────────────────────────────────────────
df["date"] = df["date"].dt.strftime("%Y-%m-%d")

# ── Step 6: Select and order final columns ─────────────────────────────────────
FINAL_COLS = [
    "date",
    "road_segment_id",
    "rainfall_mm",
    "rainfall_last_3_days",
    "slope_degrees",
    "distance_to_river_km",
    "past_landslide_count",
    "season",
    "road_blocked",
]

# Fill any remaining nulls in numeric cols
for col in ["slope_degrees", "distance_to_river_km", "past_landslide_count"]:
    if col in df.columns:
        df[col] = df[col].fillna(df[col].median())

df = df[FINAL_COLS]

# ── Step 7: Validation ─────────────────────────────────────────────────────────
print("\n=== Data Validation ===")
print(f"  Total rows        : {len(df):,}")
print(f"  Unique segments   : {df['road_segment_id'].nunique()}")
print(f"  Date range        : {df['date'].min()} to {df['date'].max()}")
print(f"  Null counts       :")
nulls = df.isnull().sum()
for col, n in nulls.items():
    status = "[OK]" if n == 0 else f"[!!] {n} nulls"
    print(f"    {col:<30s} {status}")
print(f"  Season values     : {df['season'].unique().tolist()}")
print(f"  Target balance    : {df['road_blocked'].value_counts().to_dict()}")
print(f"  Blocked rate      : {df['road_blocked'].mean():.3f}")

# Warn if severely imbalanced
blocked_rate = df["road_blocked"].mean()
if blocked_rate < 0.05:
    print(f"\n  [!] WARNING: Very low blocked rate ({blocked_rate:.3f}).")
    print("      Consider adding scale_pos_weight to XGBClassifier in train_model.py")
    print(f"      Suggested value: scale_pos_weight = {(1-blocked_rate)/blocked_rate:.1f}")
elif blocked_rate > 0.80:
    print(f"\n  [!] WARNING: Very high blocked rate ({blocked_rate:.3f}) — check labels.")

# ── Save ───────────────────────────────────────────────────────────────────────
OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(OUT_CSV, index=False)
print(f"\nSaved -> {OUT_CSV}")
print(f"  File size: {OUT_CSV.stat().st_size / 1024:.1f} KB")

print("\n" + "=" * 55)
print("PIPELINE COMPLETE — data/data.csv is ready.")
print("Next step: python src/train_model.py")
print("=" * 55)
