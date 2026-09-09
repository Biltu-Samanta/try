# NorthEastRiskAI — Road Accessibility Risk ML

> **XGBoost model for predicting road blockage risk across all 8 Northeast Indian states**  
> Uses real weather data (Open-Meteo), terrain data (SRTM DEM), and OSRM for alternate routing.

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://python.org)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.0-orange.svg)](https://xgboost.readthedocs.io)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## What It Does

Given road conditions (rainfall, slope, river proximity, season, **state**), the model predicts the **probability that a road segment is blocked** due to landslide, flooding, or weather-related disruption across **all 8 Northeast Indian states**.

**Full pipeline:**
```
Open-Meteo (rainfall) ──┐
SRTM DEM (slope)        ├──► data/data.csv ──► XGBoost ──► risk score (0–1)
OSM (road network)      │                                        │
NHAI / data.gov.in ─────┘                                   OSRM route
```

---

## Coverage — 8 Northeast Indian States

| State | Capital | Key Highways | Segments |
|---|---|---|---|
| Arunachal Pradesh | Itanagar | NH-13, Trans-Arunachal Hwy, NH-313 | ~98 |
| Assam | Dispur | NH-27, NH-15, NH-17, NH-37 | ~93 |
| Manipur | Imphal | NH-2, NH-37, NH-102, NH-150 | ~100 |
| Meghalaya | Shillong | NH-6, NH-44, NH-40, NH-106 | ~61 |
| Mizoram | Aizawl | NH-54, NH-54A, NH-302 | ~62 |
| Nagaland | Kohima | NH-2, NH-29A, NH-702 | ~56 |
| Tripura | Agartala | NH-8, NH-44, NH-44A | ~54 |
| Sikkim | Gangtok | NH-10, NH-717A, NH-31A | ~55 |

---

## Results (NE India — 8 States, 2024–2025)

| Metric | Value |
|---|---|
| Dataset size | **423,249 rows** (579 road segments × 731 days) |
| States covered | **8** (Arunachal Pradesh, Assam, Manipur, Meghalaya, Mizoram, Nagaland, Tripura, Sikkim) |
| Accuracy | **86.3%** |
| F1-score (Blocked class) | **0.87** |
| Precision (Blocked) | **0.91** |
| Recall (Blocked) | **0.83** |
| Top feature | `rain3_slope_interaction` (3-day rainfall × slope) |
| Data source | Real rainfall from Open-Meteo API ✅ |

**Per-state accuracy:**

| State | Accuracy |
|---|---|
| Assam | 88.7% |
| Tripura | 88.8% |
| Meghalaya | 88.4% |
| Manipur | 86.0% |
| Sikkim | 85.0% |
| Arunachal Pradesh | 84.7% |
| Nagaland | 84.5% |
| Mizoram | 84.0% |

---

## Project Structure

```
road-risk-ml/
├── data/
│   ├── raw/                         # Raw inputs from APIs
│   │   ├── segment_coords.csv       # Road segment GPS coordinates (all 8 states)
│   │   ├── segment_attributes.csv   # Slope, river distance, landslide count
│   │   └── labels_input/            # Drop NHAI / data.gov.in CSVs here
│   └── data.csv                     # Final model-ready dataset (423k rows)
│
├── models/
│   ├── risk_model.json              # Trained XGBoost model (NE India, 8 states)
│   ├── feature_columns.json         # Feature order for inference (12 features)
│   ├── state_encoder.json           # State name → integer mapping (0–7)
│   └── feature_importance.png       # SHAP feature importance plot
│
├── src/
│   ├── data_pipeline/
│   │   ├── run_pipeline.py          # ⭐ Run all 5 phases in one command
│   │   ├── 01_fetch_segments.py     # Road segments (OSM)
│   │   ├── 02_fetch_terrain.py      # Slope + river distance (SRTM/OSM)
│   │   ├── 03_fetch_rainfall.py     # Daily rainfall (Open-Meteo API)
│   │   ├── 04_fetch_labels.py       # Road blocked labels
│   │   └── 05_assemble_dataset.py   # Merge all → data.csv
│   ├── generate_data.py             # Synthetic data (offline fallback, all 8 states)
│   ├── train_model.py               # Training + GridSearchCV + SHAP
│   ├── predict.py                   # Inference interface (state-aware)
│   └── routing.py                   # OSRM alternate route engine
│
├── frontend/
│   ├── index.html                   # NorthEastRiskAI SPA (rebranded)
│   ├── api/app.py                   # Flask API (state-aware endpoints)
│   ├── js/app.js                    # State selector + map recentering
│   └── css/                         # Design system
│
├── notebooks/                       # Jupyter notebooks (optional)
├── GUIDE.md                         # ⭐ Full usage guide
├── REAL_DATA_GUIDE.md               # Real API integration guide
├── requirements.txt
└── .gitignore
```

---

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Build the dataset (real rainfall from Open-Meteo)
```bash
python src/data_pipeline/run_pipeline.py
```

### 3. Train the model
```bash
python src/train_model.py
```

### 4. Run predictions on real data
```bash
python src/predict.py
```

**Example output:**
```
Road Accessibility Risk Predictor - NE India (8 States)

State                     Segment        Risk%  Predicted   Actual
----------------------------------------------------------------------
  Arunachal Pradesh       SEG0006       100.0%  BLOCKED     BLOCKED OK
  Assam                   SEG0145       100.0%  BLOCKED     BLOCKED OK
  Manipur                 SEG0238       100.0%  BLOCKED     BLOCKED OK
  Meghalaya               SEG0346       100.0%  BLOCKED     BLOCKED OK
  Mizoram                 SEG0364       100.0%  BLOCKED     BLOCKED OK
  Nagaland                SEG0414       100.0%  BLOCKED     BLOCKED OK
  Sikkim                  SEG0566       100.0%  BLOCKED     BLOCKED OK
  Tripura                 SEG0470       100.0%  BLOCKED     BLOCKED OK
```

---

## Using the Prediction API in Your Code

```python
from src.predict import predict_risk

risk = predict_risk({
    "rainfall_mm":           42.0,
    "rainfall_last_3_days": 105.0,
    "slope_degrees":          30.0,
    "distance_to_river_km":    2.5,
    "past_landslide_count":    4,
    "season":               "monsoon",   # winter | summer | monsoon
    "state":                "Meghalaya", # any of the 8 NE states
    "segment_enc":            10,
    "month":                   7,
    "day_of_week":             2,
})

print(f"Risk: {risk:.1%}")   # → Risk: 94.7%

if risk >= 0.5:
    # Call OSRM for alternate route
    from src.routing import assess_route_risk
    ...
```

---

## Data Sources

| Data | Source | Status |
|------|--------|--------|
| Daily rainfall | [Open-Meteo Historical API](https://open-meteo.com) | ✅ Free, no key |
| Road segments | [OpenStreetMap](https://openstreetmap.org) via osmnx | ✅ Free |
| Slope / DEM | [SRTM 30m](https://dwtkns.com/srtm30m/) | ✅ Public |
| River distance | OSM waterway layer | ✅ Free |
| Road blocked labels | [data.gov.in](https://data.gov.in) + NHAI | ⚙ Manual download |
| GIS base layer | [Bhuvan (ISRO)](https://bhuvan.nrsc.gov.in) | ⚙ Free registration |
| Alternate routing | [OSRM](http://router.project-osrm.org) | ✅ Free public server |

---

## Adding Real Road Blockage Labels

1. Download road closure CSVs from [data.gov.in](https://data.gov.in/search?title=road+blockage)
2. Place them in `data/raw/labels_input/`
3. Re-run the pipeline — labels are merged automatically:

```bash
python src/data_pipeline/run_pipeline.py
python src/train_model.py
```

---

## SHAP Feature Importance (NE India Model, 12 Features)

| Rank | Feature | Mean |SHAP| |
|------|---------|-----------:|
| 1 | `rain3_slope_interaction` | 1.2462 |
| 2 | `rainfall_last_3_days` | 0.9764 |
| 3 | `rainfall_mm` | 0.6114 |
| 4 | `season_enc` | 0.5723 |
| 5 | `rain_slope_interaction` | 0.4709 |
| 6 | `past_landslide_count` | 0.2840 |
| 7 | `distance_to_river_km` | 0.2798 |
| 8 | `slope_degrees` | 0.2780 |
| 9 | `segment_enc` | 0.0432 |
| 10 | `day_of_week` | 0.0119 |
| 11 | `month` | 0.0089 |
| 12 | `state_enc` | 0.0041 |

> **Note:** `state_enc` provides state-level risk context while keeping the model lightweight. Rainfall-terrain interactions remain the dominant predictors across all states.

---

## License

MIT License — see [LICENSE](LICENSE)

---

## Author

NorthEastRiskAI — Road Accessibility Risk ML for Northeast India