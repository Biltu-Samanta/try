# Road Accessibility Risk ML — Project Overview & Documentation

> **Comprehensive guide to all project files, directories, architecture, and Machine Learning model inputs & outputs.**  
> **Target Region:** Manipur, India  
> **Core Objective:** Predict road blockage risk (due to landslides, floods, extreme monsoon weather) and suggest safe alternative routes.

---

## 1. Directory & File Structure

Below is the complete tree of all files and folders in the repository:

```text
road-risk-ml/
├── .gitignore
├── LICENSE
├── requirements.txt
├── README.md
├── GUIDE.md
├── REAL_DATA_GUIDE.md
├── PROJECT_OVERVIEW.md              <-- This comprehensive documentation file
│
├── data/
│   ├── data.csv                     <-- Final cleaned & assembled dataset (73,100+ rows)
│   └── raw/                         <-- Raw and intermediate pipeline data
│       ├── segment_coords.csv       <-- Road segment GPS coordinates & road info
│       ├── segment_attributes.csv   <-- Geological & terrain features per segment
│       ├── rainfall_raw.csv         <-- Historical daily rainfall data (Open-Meteo)
│       ├── road_incidents.csv       <-- Historical road blockage incidents & labels
│       ├── dem/                     <-- Cached Digital Elevation Model (SRTM) tiles
│       └── labels_input/            <-- Drop folder for official NHAI/data.gov.in CSVs
│
├── models/
│   ├── risk_model.json              <-- Serialized trained XGBoost classifier
│   ├── feature_columns.json         <-- Exact feature list & ordering for inference
│   └── feature_importance.png       <-- SHAP beeswarm feature importance plot
│
├── notebooks/
│   └── .gitkeep                     <-- Keeps empty notebook directory tracked in Git
│
└── src/
    ├── __init__.py
    ├── generate_data.py             <-- Synthetic data generator (offline fallback)
    ├── train_model.py               <-- Model training, hyperparameter tuning & SHAP
    ├── predict.py                   <-- Inference API & demo script
    ├── routing.py                   <-- OSRM-based alternate route engine
    │
    └── data_pipeline/               <-- 5-Phase automated real data collection pipeline
        ├── __init__.py
        ├── run_pipeline.py          <-- Master script running all 5 phases sequentially
        ├── 01_fetch_segments.py     <-- Phase 1: Extracts Manipur road segments from OSM
        ├── 02_fetch_terrain.py      <-- Phase 2: Computes slope, river proximity, landslides
        ├── 03_fetch_rainfall.py     <-- Phase 3: Fetches daily rainfall from Open-Meteo
        ├── 04_fetch_labels.py       <-- Phase 4: Compiles road blockage ground truth labels
        └── 05_assemble_dataset.py   <-- Phase 5: Merges all raw sources into data/data.csv
```

---

## 2. Detailed Explanation of Every File and Folder

### Root Files & Folders

| File / Folder | Purpose & Function |
| :--- | :--- |
| **`data/`** | Stores both raw downloaded data and the final assembled dataset used for model training. |
| **`models/`** | Contains the trained model artifacts, feature order mappings, and model interpretability plots. |
| **`notebooks/`** | Reserved for interactive Jupyter Notebook experiments, data exploration, and visualizations. |
| **`src/`** | Contains all Python source code for data pipelines, model training, risk inference, and routing. |
| **`requirements.txt`** | Lists all required Python packages (e.g., `xgboost`, `scikit-learn`, `shap`, `pandas`, `numpy`, `matplotlib`, `requests`, `geopandas`, `osmnx`). |
| **`README.md`** | The main project landing page containing a high-level summary, architecture diagram, benchmark results, and quick-start instructions. |
| **`GUIDE.md`** | Step-by-step user handbook detailing how to install requirements, build data, train models, predict, and interpret metrics. |
| **`REAL_DATA_GUIDE.md`** | In-depth engineering manual explaining how to integrate live public APIs (OpenStreetMap, Open-Meteo, SRTM 30m DEM, data.gov.in, NHAI, ISRO Bhuvan). |
| **`PROJECT_OVERVIEW.md`** | This document: an exhaustive reference of all files, directories, and the ML model's input/output specifications. |
| **`LICENSE`** | The MIT open-source license defining terms of use and distribution. |
| **`.gitignore`** | Specifies files and patterns Git should ignore (such as `__pycache__`, virtual environments, OS cache files). |

---

### `data/` Directory Files

| File / Subfolder | What It Does |
| :--- | :--- |
| **`data/data.csv`** | **The central training dataset.** Contains 73,100 records (100 road segments $\times$ 731 days from 2024 to 2025). Columns include segment ID, date, rainfall, 3-day rainfall accumulation, slope degrees, river distance, past landslide count, season, and the target label `road_blocked` (0 or 1). |
| **`data/raw/segment_coords.csv`** | Contains road segment metadata across major Manipur corridors (NH-2, NH-37, NH-102, NH-150, etc.) including centroid latitude/longitude, road name, highway type (national highway, primary, secondary), and road length in meters. |
| **`data/raw/segment_attributes.csv`** | Static geographical attributes mapped to each road segment: slope in degrees (from DEM), distance to the nearest river in kilometers (from OSM waterways), and historical landslide count. |
| **`data/raw/rainfall_raw.csv`** | Historical daily precipitation records (in mm) for every road segment centroid from January 1, 2024 to December 31, 2025. |
| **`data/raw/road_incidents.csv`** | Incident events recording road blockages across dates and segment IDs. |
| **`data/raw/labels_input/`** | Input folder for real-world government road closure data. Any CSV files downloaded from `data.gov.in` or NHAI placed here are automatically parsed by Phase 4 of the pipeline. |
| **`data/raw/dem/`** | Cache directory for downloaded SRTM (Shuttle Radar Topography Mission) 30-meter Digital Elevation Model raster GeoTIFF tiles. |

---

### `models/` Directory Files

| File | What It Does |
| :--- | :--- |
| **`models/risk_model.json`** | The trained **XGBoost Classifier** model serialized in JSON format (~398 KB). Loaded by `predict.py` and `routing.py` to evaluate risk in production without needing retraining. |
| **`models/feature_columns.json`** | JSON array of the 11 feature names in the exact order expected by the trained XGBoost model. Ensures inference feature vectors match the training matrix precisely. |
| **`models/feature_importance.png`** | A SHAP (SHapley Additive exPlanations) summary plot visualizing how each feature impacts road blockage risk (e.g., rainfall accumulation and slope having the strongest positive push toward blockage). |

---

### `src/` Directory Files

| File | What It Does |
| :--- | :--- |
| **`src/train_model.py`** | **The complete machine learning training pipeline.**<br>1. Loads and cleans `data/data.csv`.<br>2. Performs feature engineering (season encoding, date feature extraction, interaction terms).<br>3. Splits data into 80% training and 20% testing sets (stratified).<br>4. Fits a baseline XGBoost classifier.<br>5. Executes 3-fold cross-validated hyperparameter tuning using `GridSearchCV` over `max_depth`, `n_estimators`, and `learning_rate`.<br>6. Evaluates the best model on the holdout test set (Accuracy, Precision, Recall, F1, Confusion Matrix).<br>7. Computes SHAP explainability values and saves `feature_importance.png`.<br>8. Saves the final model to `models/risk_model.json` and feature order to `models/feature_columns.json`. |
| **`src/predict.py`** | **The inference engine.** Provides the standalone Python function `predict_risk(input_dict)` which takes road and weather parameters, validates and computes interaction terms, and returns a risk probability (0.0 to 1.0). Also includes a CLI demo evaluating real high-risk and low-risk test cases. |
| **`src/routing.py`** | **Intelligent route assessment & detour finder.** Connects to the Open Source Routing Machine (OSRM) API. It assesses whether a chosen travel corridor (e.g., Imphal to Churachandpur) exceeds safety risk thresholds, and if so, computes and recommends an alternative bypass route. |
| **`src/generate_data.py`** | Generates a synthetic dataset with realistic physical correlations (monsoon rainfall peaks, steep slopes increasing landslide probability) for rapid testing or offline prototyping when external APIs are not reachable. |

---

### `src/data_pipeline/` Directory Files

This module implements a 5-phase ETL (Extract, Transform, Load) pipeline for real-world geospatial and environmental data:

| Pipeline Script | Phase & Function |
| :--- | :--- |
| **`run_pipeline.py`** | **Master Runner:** Executes all 5 phases sequentially in one command (`python src/data_pipeline/run_pipeline.py`). Handles connectivity checks, fallback simulation if APIs are offline, and generates the final `data/data.csv`. |
| **`01_fetch_segments.py`** | **Phase 1 — Road Segments:** Extracts road network data for Manipur via OpenStreetMap / Overpass API (or realistic corridor definitions), computing road segment coordinates, names, and highway classifications. |
| **`02_fetch_terrain.py`** | **Phase 2 — Terrain Attributes:** Computes terrain slope from SRTM 30m DEM elevation data, calculates distance to nearest rivers from OSM waterways, and queries historical landslide occurrences. |
| **`03_fetch_rainfall.py`** | **Phase 3 — Historical Weather:** Fetches daily precipitation records from the free Open-Meteo Historical Weather API for each segment centroid across a 2-year timeline (2024–2025). |
| **`04_fetch_labels.py`** | **Phase 4 — Ground Truth Labels:** Ingests official road closure CSVs from `labels_input/` (from data.gov.in or NHAI), resolving timestamps and segment IDs to create binary blockage labels (`road_blocked`). |
| **`05_assemble_dataset.py`** | **Phase 5 — Final Merge & Validation:** Combines road segments, terrain attributes, rainfall history, and incident labels. Computes rolling 3-day rainfall sums, encodes seasonal variables, validates data integrity, and outputs `data/data.csv`. |

---

## 3. Machine Learning Model: Inputs & Outputs

### Model Architecture
- **Algorithm:** XGBoost Classifier (`XGBClassifier`)
- **Objective Function:** `binary:logistic` (predicts probability of blockage)
- **Tuned Hyperparameters:** `max_depth` (3 to 6), `learning_rate` (0.05 to 0.2), `n_estimators` (100 to 300)
- **Explainability:** TreeExplainer with SHAP values

```
                    ┌─────────────────────────┐
                    │      RAW INPUTS         │
                    │  - Weather (Rainfall)   │
                    │  - Terrain (Slope, DEM) │
                    │  - Geography (River)    │
                    │  - History (Landslides) │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   FEATURE ENGINEERING   │
                    │  - 3-day rain roll      │
                    │  - Rain × Slope inter.  │
                    │  - Season/Date encoding │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    XGBOOST CLASSIFIER   │
                    │  (models/risk_model.json│
                    └────────────┬────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
    ┌─────────────────────────┐     ┌─────────────────────────┐
    │     RISK PROBABILITY    │     │   BINARY CLASSIFICATION │
    │       (0.0 to 1.0)      │     │      0 = Road Open      │
    │   e.g. 0.9423 (94.2%)   │     │      1 = Road Blocked   │
    └────────────┬────────────┘     └─────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────┐
    │           ROUTING ENGINE (OSRM)         │
    │  - If Risk < 0.5: Direct route safe     │
    │  - If Risk >= 0.5: Detour recommended   │
    └─────────────────────────────────────────┘
```

---

### Model Inputs

The model evaluates **11 numeric features** for each road segment and date:

| # | Feature Name | Data Type | Units / Range | Description | How It Is Obtained |
| :-: | :--- | :---: | :---: | :--- | :--- |
| **1** | `rainfall_mm` | `float` | $0.0 \text{ to } 200.0+\text{ mm}$ | Total precipitation on the target day | Live/Historical weather API (Open-Meteo) or rain gauge |
| **2** | `rainfall_last_3_days` | `float` | $0.0 \text{ to } 500.0+\text{ mm}$ | Cumulative 3-day rainfall sum ($t_{-2} + t_{-1} + t$) | Rolling 3-day sum of precipitation |
| **3** | `slope_degrees` | `float` | $0.0^\circ \text{ to } 45.0^\circ+$ | Steepness / incline of the surrounding terrain | SRTM 30m Digital Elevation Model (DEM) gradient |
| **4** | `distance_to_river_km` | `float` | $0.1 \text{ to } 25.0+\text{ km}$ | Distance from road to closest river/waterway | OpenStreetMap waterway layer GIS distance query |
| **5** | `past_landslide_count` | `int` | $0 \text{ to } 10+$ | Historical landslides recorded on this segment | Geological Survey of India / NRSC Landslide Atlas |
| **6** | `season_enc` | `int` | `0`, `1`, `2` | Ordinal risk encoding of season:<br>• `0`: Winter (dry, lowest risk)<br>• `1`: Summer / Pre-monsoon<br>• `2`: Monsoon (heavy rain, highest risk) | Mapped from calendar month or input `"season"` string |
| **7** | `segment_enc` | `int` | $0 \text{ to } N-1$ | Categorical label encoding of road segment ID | Assigned per segment from `segment_coords.csv` |
| **8** | `month` | `int` | $1 \text{ to } 12$ | Calendar month ($1=\text{Jan}, \dots, 12=\text{Dec}$) | Extracted from query date |
| **9** | `day_of_week` | `int` | $0 \text{ to } 6$ | Day of the week ($0=\text{Mon}, \dots, 6=\text{Sun}$) | Extracted from query date |
| **10** | `rain_slope_interaction` | `float` | $\ge 0.0$ | Engineered interaction term:<br>$\frac{\text{rainfall\_mm} \times \text{slope\_degrees}}{100.0}$ | Automatically computed in `predict.py` |
| **11** | `rain3_slope_interaction` | `float` | $\ge 0.0$ | Engineered interaction term:<br>$\frac{\text{rainfall\_last\_3\_days} \times \text{slope\_degrees}}{100.0}$<br>*(#1 most important feature in SHAP analysis)* | Automatically computed in `predict.py` |

> **User-friendly convenience in `predict.py`:**  
> When calling `predict_risk(input_dict)`, the caller only needs to pass raw intuitive values (e.g. `season="monsoon"`, `slope_degrees=32.5`, `rainfall_mm=60.0`, `rainfall_last_3_days=150.0`). The interaction terms (`rain_slope_interaction`, `rain3_slope_interaction`) and `season_enc` are computed automatically by `predict.py`.

---

### Model Outputs

When the model processes the inputs, it produces two direct outputs and one downstream decision output:

#### 1. Risk Probability (`float` between `0.0` and `1.0`)
- Represents the likelihood that the specified road segment will suffer a blockage or disruption.
- Example: `0.9423` indicates a **94.2% probability of blockage**.
- Example: `0.0315` indicates a **3.2% probability of blockage (safe)**.

#### 2. Binary Status Label (`road_blocked`: `0` or `1`)
- Derived by comparing the risk probability against a decision threshold (default: $0.5$ or $50\%$):
  - **`1` (`"BLOCKED"`):** Risk probability $\ge 0.5$. Road is impassable due to landslide, mudslide, or flooding.
  - **`0` (`"OPEN"`):** Risk probability $< 0.5$. Road is clear and passable.

#### 3. Downstream Routing & Actionable Recommendation (via `routing.py`)
- **Direct Route Details:** Distance in km, estimated travel time in minutes, GeoJSON coordinate line string.
- **Safety Status:** `is_high_risk: True/False`.
- **Alternative Safe Route:** If `is_high_risk` is `True`, queries OSRM for a secondary bypass waypoint route that circumvents the hazardous mountain segment.
- **Human-readable Recommendation:** Explanatory text advising the driver or disaster response team whether to proceed or take the detour.

---

## 4. Input & Output Examples

### Example A: High-Risk Scenario (Monsoon Hill Road)

**Input Condition:**
```python
{
    "rainfall_mm": 55.0,            # 55 mm torrential rain today
    "rainfall_last_3_days": 180.0,   # 180 mm accumulated rain over 3 days
    "slope_degrees": 36.5,           # Steep 36.5° mountain slope
    "distance_to_river_km": 1.2,     # 1.2 km from river basin
    "past_landslide_count": 6,       # 6 previous landslides here
    "season": "monsoon",             # Monsoon season
    "segment_enc": 14,
    "month": 7,                      # July
    "day_of_week": 3                 # Thursday
}
```

**Model Output:**
```json
{
  "risk_probability": 0.9984,
  "risk_percentage": "99.8%",
  "predicted_status": "BLOCKED",
  "is_high_risk": true,
  "recommendation": "Risk probability 99.8% exceeds threshold 50%. Direct route NOT recommended. Detour calculated."
}
```

---

### Example B: Low-Risk Scenario (Dry Winter Valley Road)

**Input Condition:**
```python
{
    "rainfall_mm": 0.0,              # No rain
    "rainfall_last_3_days": 1.5,     # Only 1.5 mm in past 3 days
    "slope_degrees": 8.0,            # Gentle 8.0° slope (valley)
    "distance_to_river_km": 8.5,     # Far from river
    "past_landslide_count": 0,       # No prior landslides
    "season": "winter",              # Dry winter
    "segment_enc": 5,
    "month": 1,                      # January
    "day_of_week": 1                 # Tuesday
}
```

**Model Output:**
```json
{
  "risk_probability": 0.0142,
  "risk_percentage": "1.4%",
  "predicted_status": "OPEN",
  "is_high_risk": false,
  "recommendation": "Risk probability 1.4% is below threshold. Direct route is safe."
}
```

---

## 5. How to Run & Use the System

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Build the dataset from raw / API sources
python src/data_pipeline/run_pipeline.py

# 3. Train the XGBoost model & generate SHAP importance plot
python src/train_model.py

# 4. Run risk prediction demo
python src/predict.py

# 5. Run route risk assessment demo
python src/routing.py
```
