"""
predict.py — Load trained NE India model and predict road accessibility risk probability.
Supports all 8 Northeast Indian states.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from xgboost import XGBClassifier

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT              = Path(__file__).resolve().parents[1]
MODEL_PATH        = ROOT / "models" / "risk_model.json"
FEAT_COLS_PATH    = ROOT / "models" / "feature_columns.json"
STATE_ENC_PATH    = ROOT / "models" / "state_encoder.json"

# ── Season encoding (must match train_model.py) ─────────────────────────────
SEASON_ORDER = {"winter": 0, "summer": 1, "monsoon": 2}

# ── Default state encoder fallback ─────────────────────────────────────────
DEFAULT_STATE_ENC = {
    "Arunachal Pradesh": 0,
    "Assam":             1,
    "Manipur":           2,
    "Meghalaya":         3,
    "Mizoram":           4,
    "Nagaland":          5,
    "Tripura":           6,
    "Sikkim":            7,
}


_ARTIFACTS_CACHE = None

def _load_artifacts():
    """Load model, feature column list, and state encoder from disk (cached)."""
    global _ARTIFACTS_CACHE
    if _ARTIFACTS_CACHE is not None:
        return _ARTIFACTS_CACHE

    model = XGBClassifier()
    model.load_model(str(MODEL_PATH))

    with open(FEAT_COLS_PATH) as f:
        feature_columns = json.load(f)

    # Load state encoder (fall back to default if file doesn't exist yet)
    if STATE_ENC_PATH.exists():
        with open(STATE_ENC_PATH) as f:
            state_enc = json.load(f)
    else:
        state_enc = DEFAULT_STATE_ENC

    _ARTIFACTS_CACHE = (model, feature_columns, state_enc)
    return _ARTIFACTS_CACHE


def predict_risk(input_dict: dict) -> float:
    """
    Predict road blockage risk probability.

    Parameters
    ----------
    input_dict : dict
        Required keys:
            rainfall_mm            – today's rainfall in mm
            rainfall_last_3_days   – 3-day rolling rainfall sum in mm
            slope_degrees          – road slope in degrees (0–45)
            distance_to_river_km   – distance to nearest river in km
            past_landslide_count   – historical landslide count for segment (0–10)
            season                 – one of "winter", "summer", "monsoon"
            segment_enc            – integer-encoded road segment id (0–N-1)
            month                  – calendar month (1–12)
            day_of_week            – day of week (0=Mon … 6=Sun)

        New keys (NE India expansion):
            state                  – one of the 8 NE Indian state names
                                     e.g. "Manipur", "Assam", "Meghalaya", …

        Derived automatically (or can be overridden):
            rain_slope_interaction  – rainfall_mm × slope_degrees / 100
            rain3_slope_interaction – rainfall_last_3_days × slope_degrees / 100
            season_enc              – encoded from 'season' key
            state_enc               – encoded from 'state' key

    Returns
    -------
    float
        Probability of road being blocked (0.0 – 1.0).
    """
    model, feature_columns, state_enc_map = _load_artifacts()

    d = dict(input_dict)

    # Encode season if raw string is given
    if "season_enc" not in d and "season" in d:
        d["season_enc"] = SEASON_ORDER.get(d["season"].lower(), 0)

    # Encode state if raw string is given
    if "state_enc" not in d and "state" in d:
        state_name = d["state"]
        # Try exact match first, then case-insensitive
        d["state_enc"] = state_enc_map.get(
            state_name,
            next((v for k, v in state_enc_map.items()
                  if k.lower() == state_name.lower()), 2)  # default to Manipur=2
        )

    # Compute interaction features if not supplied
    if "rain_slope_interaction" not in d:
        d["rain_slope_interaction"] = d["rainfall_mm"] * d["slope_degrees"] / 100.0
    if "rain3_slope_interaction" not in d:
        d["rain3_slope_interaction"] = d["rainfall_last_3_days"] * d["slope_degrees"] / 100.0

    # Build correctly-ordered feature vector
    row = {col: d.get(col, 0) for col in feature_columns}
    X   = pd.DataFrame([row])[feature_columns]

    prob = float(model.predict_proba(X)[0, 1])
    return prob


def predict_risk_batch(input_dicts: list) -> list:
    """Batch predict blockage risk probabilities for multiple segments efficiently."""
    if not input_dicts:
        return []
    model, feature_columns, state_enc_map = _load_artifacts()
    
    rows = []
    for raw_d in input_dicts:
        d = dict(raw_d)
        if "season_enc" not in d and "season" in d:
            d["season_enc"] = SEASON_ORDER.get(d["season"].lower(), 0)
        if "state_enc" not in d and "state" in d:
            st = d["state"]
            d["state_enc"] = state_enc_map.get(st, next((v for k, v in state_enc_map.items() if k.lower() == st.lower()), 2))
        if "rain_slope_interaction" not in d:
            d["rain_slope_interaction"] = d["rainfall_mm"] * d["slope_degrees"] / 100.0
        if "rain3_slope_interaction" not in d:
            d["rain3_slope_interaction"] = d["rainfall_last_3_days"] * d["slope_degrees"] / 100.0
        rows.append({col: d.get(col, 0) for col in feature_columns})

    X = pd.DataFrame(rows)[feature_columns]
    probs = model.predict_proba(X)[:, 1]
    return [float(p) for p in probs]


# ── Example usage ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("Road Accessibility Risk Predictor — NE India (8 States)")
    print("=" * 60)

    DATA_PATH = ROOT / "data" / "data.csv"
    SEGS_PATH = ROOT / "data" / "raw" / "segment_coords.csv"

    if not DATA_PATH.exists():
        print(f"ERROR: {DATA_PATH} not found.")
        print("Run: python src/data_pipeline/run_pipeline.py  first.")
        raise SystemExit(1)

    df   = pd.read_csv(DATA_PATH, parse_dates=["date"])
    segs = pd.read_csv(SEGS_PATH) if SEGS_PATH.exists() else None

    print(f"\nDataset: {len(df):,} rows | {df['road_segment_id'].nunique()} segments "
          f"| {df['state'].nunique()} states")
    print(f"States : {sorted(df['state'].unique())}")

    # Build segment_enc lookup
    seg_list = sorted(df["road_segment_id"].unique())
    seg_enc  = {s: i for i, s in enumerate(seg_list)}

    def row_to_input(row):
        return {
            "rainfall_mm":           float(row["rainfall_mm"]),
            "rainfall_last_3_days":  float(row["rainfall_last_3_days"]),
            "slope_degrees":         float(row["slope_degrees"]),
            "distance_to_river_km":  float(row["distance_to_river_km"]),
            "past_landslide_count":  int(row["past_landslide_count"]),
            "season":                str(row["season"]),
            "state":                 str(row["state"]),
            "segment_enc":           seg_enc.get(row["road_segment_id"], 0),
            "month":                 int(row["date"].month),
            "day_of_week":           int(row["date"].dayofweek),
        }

    # Test one blocked monsoon row per state
    print("\n[Per-state high-risk predictions]")
    print(f"{'State':<25} {'Segment':<12} {'Risk%':>7}  {'Predicted':<10}  {'Actual'}")
    print("-" * 70)
    for state in sorted(df["state"].unique()):
        state_df = df[
            (df["state"] == state) &
            (df["road_blocked"] == 1) &
            (df["season"] == "monsoon")
        ].sort_values("rainfall_last_3_days", ascending=False)

        if state_df.empty:
            state_df = df[(df["state"] == state) & (df["road_blocked"] == 1)]
        if state_df.empty:
            continue

        row   = state_df.iloc[0]
        prob  = predict_risk(row_to_input(row))
        pred  = "BLOCKED" if prob >= 0.5 else "OPEN"
        actual = "BLOCKED" if row["road_blocked"] == 1 else "OPEN"
        ok    = "OK" if pred == actual else "!!"
        print(f"  {state:<23} {row['road_segment_id']:<12} {prob*100:6.1f}%  {pred:<10}  {actual} {ok}")

    print("\n" + "=" * 60)
    print("Prediction complete.")
    print("=" * 60)
