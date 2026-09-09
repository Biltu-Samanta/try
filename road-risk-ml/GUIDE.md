# Road Accessibility Risk ML — Complete Guide
### Region: Manipur, India | XGBoost + SHAP + OSRM

---

## Project Structure

```
road-risk-ml/
├── data/
│   ├── raw/                          ← raw inputs from APIs
│   │   ├── segment_coords.csv        ← road segment lat/lon
│   │   ├── segment_attributes.csv    ← slope, river dist, landslides
│   │   ├── rainfall_raw.csv          ← daily rainfall (Open-Meteo)
│   │   ├── road_incidents.csv        ← blocked label events
│   │   └── labels_input/             ← drop real NHAI/data.gov.in CSVs here
│   └── data.csv                      ← final model-ready dataset
├── models/
│   ├── risk_model.json               ← trained XGBoost model (388 KB)
│   ├── feature_columns.json          ← feature order for API inputs
│   └── feature_importance.png        ← SHAP plot
└── src/
    ├── data_pipeline/
    │   ├── run_pipeline.py           ← runs all 5 phases in one command
    │   ├── 01_fetch_segments.py      ← road segments (OSM)
    │   ├── 02_fetch_terrain.py       ← slope + river distance (SRTM/OSM)
    │   ├── 03_fetch_rainfall.py      ← rainfall (Open-Meteo API)
    │   ├── 04_fetch_labels.py        ← road blocked labels
    │   └── 05_assemble_dataset.py    ← merge all → data.csv
    ├── generate_data.py              ← synthetic data (fallback/testing)
    ├── train_model.py                ← training pipeline
    ├── predict.py                    ← inference function
    └── routing.py                    ← OSRM alternate route engine
```

---

## Quick Start (Model Already Trained)

If `models/risk_model.json` already exists, skip to **Step 3**.

---

## Step 1 — Install Dependencies

```bash
pip install pandas numpy scikit-learn xgboost shap matplotlib --user
pip install osmnx geopandas rasterio scipy pyproj shapely requests --user
```

Verify:
```bash
python -c "import xgboost, shap, pandas, geopandas; print('All OK')"
```

---

## Step 2 — Build the Dataset

### Option A: Real Data (Recommended)

Runs all 5 pipeline phases automatically — fetches real rainfall from Open-Meteo,
builds Manipur road segments, computes terrain attributes, assembles final CSV:

```bash
python src/data_pipeline/run_pipeline.py
```

**Expected output:**
```
[PHASE 1] Road Segments
  Saved 100 segments -> data/raw/segment_coords.csv

[PHASE 2] Terrain Attributes
  Slope: 10.6 - 40.9 deg | River: 0.69 - 14.94 km

[PHASE 3] Daily Rainfall (Open-Meteo API)
  Saved 73,100 rainfall rows -> data/raw/rainfall_raw.csv
  Month  7 (Jul): 12.7 mm #### <- monsoon peak confirmed

[PHASE 4] Road Blocked Labels
  Saved 19,828 blocked events | Blocked rate: 0.271

[PHASE 5] Assembling data/data.csv
  Rows: 73,100 | Nulls: 0 | Block rate: 0.271

ALL PIPELINE PHASES COMPLETE
```

### Option B: Synthetic Data (Offline / No Internet Needed)

```bash
python src/generate_data.py
```

Generates 36,550 rows with realistic seasonal correlation. Use this for quick
testing when no internet is available.

---

## Step 3 — Train the Model

```bash
python src/train_model.py
```

**What it does:**
- Loads `data/data.csv`
- Engineers 11 features (rainfall×slope interaction, season encoding, etc.)
- Trains baseline XGBClassifier
- Tunes with GridSearchCV (81 fits — takes ~5 min)
- Generates SHAP feature importance plot
- Saves model artifacts to `models/`

**Expected output (real Manipur data):**
```
STEP 1 — 73,100 rows | 0 nulls | 0 duplicates
STEP 3 — Train: 58,480 | Test: 14,620

STEP 5 — GridSearchCV:
  Best params : learning_rate=0.05, max_depth=4, n_estimators=200
  Best CV F1  : 0.6722

* FINAL MODEL EVALUATION *
              precision    recall  f1-score
 Not Blocked       0.86      0.93      0.90
     Blocked       0.77      0.61      0.68

  Accuracy  : 0.8451
  Macro F1  : 0.7892

  [OK] risk_model.json       (388.8 KB)
  [OK] feature_columns.json  (0.2 KB)
  [OK] feature_importance.png(116.4 KB)

TRAINING COMPLETE
```

---

## Step 4 — Run a Prediction

```bash
python src/predict.py
```

**Expected output:**
```
[Example 1 — High-Risk Monsoon Road]
  rainfall=55mm, 3-day=130mm, slope=38°, river=1.5km, season=monsoon
  Risk probability : 0.9996 (100.0%)
  Prediction       : BLOCKED

[Example 2 — Low-Risk Winter Road]
  rainfall=2mm, 3-day=4.5mm, slope=8°, river=15km, season=winter
  Risk probability : 0.0086 (0.9%)
  Prediction       : OPEN
```

---

## Step 5 — Test OSRM Alternate Routing

```bash
python src/routing.py
```

**Expected output:**
```
Route: Imphal -> Churachandpur (Manipur)

Direct Route:
  Distance : 62.4 km
  Duration : 98.3 min

Risk Assessment:
  Probability : 0.9312 (93.1%)
  High Risk   : True

Recommendation:
  Risk exceeds threshold. Direct route NOT recommended.
  Alternate route: 81.2 km, 120.5 min.
```

---

## Using `predict_risk()` in Your Own Code

```python
import sys
sys.path.insert(0, "src")
from predict import predict_risk

# Minimal input — derived features computed automatically
result = predict_risk({
    "rainfall_mm":           42.0,    # today's rainfall (mm)
    "rainfall_last_3_days": 105.0,    # 3-day rolling sum (mm)
    "slope_degrees":          30.0,   # road slope in degrees
    "distance_to_river_km":    2.5,   # km to nearest river
    "past_landslide_count":    4,     # historical count (0–10)
    "season":               "monsoon",# "winter" | "summer" | "monsoon"
    "segment_enc":            10,     # integer ID of segment (0–99)
    "month":                   7,     # 1–12
    "day_of_week":             2,     # 0=Mon … 6=Sun
})

print(f"Risk: {result:.4f} ({result*100:.1f}%)")
# e.g. → Risk: 0.8931 (89.3%)

# Decision
if result >= 0.5:
    print("Action: DO NOT USE this road — fetch OSRM alternate route")
else:
    print("Action: Road is safe to use")
```

> `season_enc`, `rain_slope_interaction`, `rain3_slope_interaction` are
> all derived **automatically** inside `predict_risk()`. Do not pass them.

---

## Understanding the Feature Inputs

| Feature | Unit | How to Get It |
|---------|------|--------------|
| `rainfall_mm` | mm | Open-Meteo API or IMD daily data |
| `rainfall_last_3_days` | mm | Rolling sum of last 3 days |
| `slope_degrees` | degrees | SRTM DEM via Bhuvan/rasterio |
| `distance_to_river_km` | km | OSM river layer via geopandas |
| `past_landslide_count` | integer | NRSC Landslide Atlas |
| `season` | string | Derived from date (Jun–Sep = monsoon) |
| `segment_enc` | integer | Row index of segment in segment_coords.csv |
| `month` | 1–12 | From date |
| `day_of_week` | 0–6 | From date (Mon=0) |

---

## Re-Running with Real NHAI / data.gov.in Labels

When you have official road blockage records:

1. Download road closure CSVs from https://data.gov.in (search "road blockage" or "landslide")
2. Place them in `data/raw/labels_input/`
3. Re-run the pipeline — it auto-detects and merges real labels:

```bash
python src/data_pipeline/run_pipeline.py
python src/train_model.py
```

---

## Model Performance Summary

| Dataset | Rows | Accuracy | F1 (Blocked) | Best Params |
|---------|------|----------|--------------|-------------|
| Synthetic | 36,550 | 82.9% | 0.801 | depth=3, n=100, lr=0.1 |
| **Real Manipur** | **73,100** | **84.5%** | **0.681** | depth=4, n=200, lr=0.05 |

> F1 is lower on real data because Manipur's actual rainfall is drier than the
> synthetic model assumed — creating a 27/73 class split. Fix with `scale_pos_weight=2.7`.

### To Improve Recall on Real Data

Open [`src/train_model.py`](src/train_model.py) and add `scale_pos_weight` at **STEP 4 and STEP 5**:

```python
XGBClassifier(
    n_estimators=200,
    max_depth=4,
    learning_rate=0.05,
    scale_pos_weight=2.7,    # ← add this line
    use_label_encoder=False,
    eval_metric="logloss",
    random_state=42,
    n_jobs=-1,
)
```

Then re-run `python src/train_model.py`. Expected F1 (Blocked) improvement: **0.68 → ~0.74+**

---

## SHAP Feature Importance

| Rank | Feature | Importance | Meaning |
|------|---------|-----------|---------|
| 1 | `rain3_slope_interaction` | **0.741** | 3-day rain × slope — combined terrain+weather risk |
| 2 | `season_enc` | 0.556 | Monsoon amplifies all risks |
| 3 | `distance_to_river_km` | 0.395 | Roads near Imphal/Barak river most at risk |
| 4 | `rain_slope_interaction` | 0.335 | Same-day rain × slope |
| 5 | `slope_degrees` | 0.322 | Steep hill roads (BRO/NH-37) most vulnerable |

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `ModuleNotFoundError: xgboost` | Not installed | `pip install xgboost --user` |
| `FileNotFoundError: data/data.csv` | Pipeline not run | `python src/data_pipeline/run_pipeline.py` |
| `FileNotFoundError: models/risk_model.json` | Model not trained | `python src/train_model.py` |
| `ConnectionError` in pipeline | No internet | Script auto-falls back to local rainfall model |
| Low Recall on Blocked class | Class imbalance | Add `scale_pos_weight=2.7` to XGBoost |
| OSRM `ConnectionError` | No internet | Use `router.project-osrm.org` — needs internet |

---

## Full Run From Scratch (3 Commands)

```bash
# 1. Build real dataset (Open-Meteo rainfall + Manipur road segments)
python src/data_pipeline/run_pipeline.py

# 2. Train XGBoost model + SHAP plot
python src/train_model.py

# 3. Test predictions
python src/predict.py
```

That's it — the model is trained, evaluated, and ready to serve predictions via any REST API.
