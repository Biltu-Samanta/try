# Tech Stack — NorthEastRiskAI Road Risk Analyzer

> **Project:** Intelligent Road Risk Analysis & Safe Route Recommendation System  
> **Target Region:** Northeast India (Manipur & all 8 NE states)  
> **Architecture:** Vanilla HTML5/CSS3/JS frontend + Python Flask backend + XGBoost ML pipeline

---

## 🗂️ Project Structure Overview

```
complete Road risk analyzer/
├── Front/              ← Frontend (HTML/CSS/JS) + Flask API server
│   ├── api/app.py      ← Flask REST API backend
│   ├── css/            ← Vanilla CSS design system & components
│   └── js/             ← Vanilla JavaScript (ES Modules)
└── road-risk-ml/       ← ML pipeline, data collection, model training
    ├── src/            ← Python source (training, inference, routing)
    ├── data/           ← Datasets (CSV)
    └── models/         ← Trained model artifacts
```

---

## 🖥️ Frontend

| Technology | Version | Role |
|:-----------|:--------|:-----|
| **HTML5** | — | App structure and semantic markup |
| **CSS3 (Vanilla)** | — | Custom design system (`design-system.css`, `components.css`) |
| **JavaScript (ES Modules)** | ES2020+ | App logic, screen routing, API calls, live updates |
| **Leaflet.js** | 1.9.4 | Interactive GIS map rendering for road segments and overlays |
| **Leaflet.MarkerCluster** | 1.5.3 | Map marker clustering for vehicle tracking and alert pins |
| **Fetch API** | — | REST API client (`api.js`) for communicating with the Flask backend |
| **Server-Sent Events (SSE)** | — | Live alert feed streaming from the Flask backend |

### Frontend Architecture Notes
- **No Node.js / npm / build tools** — fully native browser ES Modules (`import`/`export`)
- Served directly from Flask at `http://localhost:5050`
- Design system uses CSS custom properties (variables), glassmorphism, and gradient animations
- Screen-based SPA routing managed in `js/app.js` without any framework

---

## ⚙️ Backend — REST API

| Technology | Role |
|:-----------|:-----|
| **Python 3** | Primary backend language |
| **Flask** | Lightweight REST API server (serves both frontend static files and `/api` routes) |
| **Flask-CORS** | Cross-Origin Resource Sharing support for decoupled frontend/backend development |
| **Pandas** | Dataset loading and data manipulation for CSV files |
| **JSON** | API response serialization; model/feature artifact format |

### API Endpoints Served
- `GET /api/status` — Health check
- `GET /api/segments` — Road segment data with risk scores
- `GET /api/alerts` — Current active alerts
- `GET /api/analytics` — Historical trend data
- `POST /api/predict` — On-demand ML risk prediction
- `POST /api/route` — Route risk assessment and detour calculation
- `GET /api/stream/alerts` — SSE live alert stream

---

## 🤖 Machine Learning Pipeline

| Technology | Version | Role |
|:-----------|:--------|:-----|
| **Python 3** | — | Pipeline language |
| **XGBoost** | ≥ 2.0.0 | Primary classifier (`XGBClassifier`, `binary:logistic`) |
| **scikit-learn** | ≥ 1.3.0 | `GridSearchCV` hyperparameter tuning, `train_test_split`, metrics |
| **SHAP** | ≥ 0.44.0 | Model explainability (TreeExplainer, beeswarm feature importance plots) |
| **Pandas** | ≥ 2.0.0 | Data loading, feature engineering, rolling aggregations |
| **NumPy** | ≥ 1.24.0 | Numerical computations and array operations |
| **Matplotlib** | ≥ 3.7.0 | SHAP feature importance plot generation (`feature_importance.png`) |
| **joblib** | ≥ 1.3.0 | Model serialization / deserialization |
| **SciPy** | ≥ 1.11.0 | Scientific computing utilities |

### Model Details
- **Algorithm:** XGBoost Classifier (`XGBClassifier`)
- **Objective:** `binary:logistic` — predicts road blockage probability (0.0–1.0)
- **Tuned Hyperparameters:** `max_depth`, `learning_rate`, `n_estimators` via 3-fold `GridSearchCV`
- **Features:** 11 numeric features (rainfall, slope, river proximity, landslide history, season, date components, interaction terms)
- **Model Artifact:** Serialized as `models/risk_model.json`

---

## 🗺️ Geospatial & GIS Stack

| Technology | Version | Role |
|:-----------|:--------|:-----|
| **OSMnx** | ≥ 1.9.0 | Extracts road network data from OpenStreetMap for Manipur (Phase 1 pipeline) |
| **GeoPandas** | ≥ 0.14.0 | Geospatial data manipulation, river distance queries, GIS operations |
| **Rasterio** | ≥ 1.3.0 | Reading SRTM 30m Digital Elevation Model (DEM) GeoTIFF raster tiles |
| **Shapely** | ≥ 2.0.0 | Geometric operations (nearest river distance, polygon queries) |
| **PyProj** | ≥ 3.6.0 | Coordinate Reference System (CRS) transformations |
| **Leaflet.js** | 1.9.4 | Frontend interactive map (tile layers, markers, polylines, overlays) |

---

## 🌐 External APIs & Data Sources

| API / Source | Purpose |
|:-------------|:--------|
| **OpenStreetMap (OSM) / Overpass API** | Road segment extraction (highway names, coordinates, classification) |
| **Open-Meteo Historical Weather API** | Daily precipitation records for each road segment centroid (free, no API key) |
| **SRTM 30m DEM (NASA/USGS)** | Digital Elevation Model for terrain slope computation |
| **OSRM (Open Source Routing Machine)** | Alternate route computation and travel time estimation |
| **data.gov.in / NHAI** | Official road closure and incident ground truth labels |
| **ISRO Bhuvan / NRSC** | Historical landslide occurrence data |

---

## 🗃️ Data Formats & Storage

| Format | Usage |
|:-------|:------|
| **CSV** | All datasets (`data.csv`, `segment_coords.csv`, `rainfall_raw.csv`, `road_incidents.csv`) |
| **JSON** | Model artifact (`risk_model.json`), feature column order (`feature_columns.json`), API responses |
| **GeoTIFF** | Cached SRTM DEM raster tiles (`data/raw/dem/`) |
| **PNG** | SHAP feature importance visualization (`models/feature_importance.png`) |

---

## 🛠️ Development Tools & Infrastructure

| Tool | Role |
|:-----|:-----|
| **Python 3** | All backend, ML, and pipeline code |
| **pip** | Python package manager (`requirements.txt`) |
| **Git** | Version control (`.gitignore` configured for both repos) |
| **Jupyter Notebooks** | Optional interactive data exploration (`notebooks/` directory) |
| **PowerShell / CMD** | Windows shell for running the application |
| **`run.bat`** | One-click Windows launcher (starts Flask server + opens browser) |
| **Python `http.server`** | Optional standalone static frontend server (dev mode) |

---

## 📦 Full Python Dependency List

```text
# Core ML
pandas>=2.0.0
numpy>=1.24.0
scikit-learn>=1.3.0
xgboost>=2.0.0
shap>=0.44.0
matplotlib>=3.7.0
joblib>=1.3.0

# GIS / Geospatial
osmnx>=1.9.0
geopandas>=0.14.0
rasterio>=1.3.0
shapely>=2.0.0
pyproj>=3.6.0
scipy>=1.11.0

# API / Networking
requests>=2.31.0

# Web Backend
flask
flask-cors

# Optional: Jupyter
# jupyter>=1.0.0
# ipykernel>=6.0.0
```

---

## 🏛️ Architecture Summary

```
┌──────────────────────────────────────────────────────────┐
│                    BROWSER (Frontend)                    │
│  HTML5 + CSS3 (Vanilla)  ·  JavaScript ES Modules        │
│  Leaflet.js (GIS Map)  ·  Fetch API  ·  SSE              │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP REST / SSE
                         ▼
┌──────────────────────────────────────────────────────────┐
│                Flask REST API (Python)                   │
│  flask · flask-cors · pandas · json                      │
│  Port 5050  ·  Serves static frontend + /api routes      │
└──────┬───────────────────────────────────┬───────────────┘
       │                                   │
       ▼                                   ▼
┌─────────────────┐              ┌─────────────────────────┐
│  ML Engine      │              │  Routing Engine          │
│  XGBoost Model  │              │  OSRM API               │
│  predict.py     │              │  routing.py             │
│  scikit-learn   │              │  Haversine distance     │
│  SHAP           │              │  Alternate route finder │
└────────┬────────┘              └─────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│              Data Pipeline (5 Phases)                    │
│  OSMnx (OSM)  ·  Open-Meteo  ·  SRTM DEM (rasterio)    │
│  GeoPandas  ·  Shapely  ·  pandas  ·  numpy             │
└──────────────────────────────────────────────────────────┘
```
