# NorthEastRiskAI (SIH-26002-NER-Logistic) — 3D Geospatial Road Accessibility Intelligence & Resilient Routing

> **Enterprise-grade Machine Learning & GIS Platform for Predicting Road Blockage Risks and Safe Alternate Routing across all 8 Northeast Indian States.**
> Powered by XGBoost, Open-Meteo rainfall telemetry, SRTM digital elevation terrain data, and real-time graph pathfinding.

[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6.svg?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.0-F8991D.svg)](https://xgboost.readthedocs.io)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📌 Executive Summary

Northeast India faces severe connectivity bottlenecks during monsoon and winter seasons due to landslides, flash floods, and subgrade deformation. **NorthEastRiskAI** delivers an end-to-end intelligence suite combining:

1. **State-Aware XGBoost Risk Classifier**: Trained on **423,249 historical data points** across 579 road segments and all 8 Northeast states with **86.3% test accuracy** and **0.87 F1-score**.
2. **Dynamic Risk-Weighted Routing Engine**: Real-time road network graph evaluating safety, elevation gradient, and live flood/landslide danger to compute the optimal path.
3. **Immersive GIS Command Center**: High-performance React application featuring interactive 2D/3D map modes, district vulnerability matrices, fleet tracking, field incident reporting, and real-time telemetry streaming.

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Applications                           │
│     React 19 + TypeScript + Vite + TanStack Router (Port 3000 / 5173)   │
│   • Live Interactive GIS Map        • Route Planning & Safe Corridors   │
│   • Regional Vulnerability Matrix   • Fleet Telemetry & Field Reports   │
└────────────────────────────────────▲────────────────────────────────────┘
                                     │ HTTP REST & SSE (/api/*)
┌────────────────────────────────────▼────────────────────────────────────┐
│                    Flask REST API Server (Port 5050)                    │
│   • /api/segments       • /api/assess-route   • /api/alerts             │
│   • /api/incidents      • /api/corridors      • /api/stream-telemetry   │
└────────────────────────────────────▲────────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌──────────────────────────────────────┐   ┌───────────────────────────────┐
│     ML Inference & Routing (ml/)     │   │      Data Layer (data/)       │
│  • predict.py (XGBoost Classifier)   │   │  • data.csv (423k rows)       │
│  • routing.py (OSRM & Graph Dijkstra)│   │  • raw/segment_coords.csv     │
│  • models/risk_model.json            │   │  • raw/road_incidents.csv     │
└──────────────────────────────────────┘   └───────────────────────────────┘
```

---

## 📁 Clean Repository Structure

```plaintext
SIH-prototype-level-02/
├── backend/                        # Python Flask REST API Server
│   ├── app.py                      # REST endpoints, SSE telemetry, data connectors
│   └── wsgi.py                     # Production WSGI application entry
│
├── ml/                             # Machine Learning & Geospatial Core
│   ├── data_pipeline/              # Multi-source ETL ingestion (OSM, SRTM, Open-Meteo)
│   │   ├── 01_fetch_segments.py
│   │   ├── 02_fetch_terrain.py
│   │   ├── 03_fetch_rainfall.py
│   │   ├── 04_fetch_labels.py
│   │   ├── 05_assemble_dataset.py
│   │   └── run_pipeline.py
│   ├── generate_data.py            # Feature augmentation & synthetic generator
│   ├── train_model.py              # XGBoost training & evaluation pipeline
│   ├── predict.py                  # Real-time risk probability inference engine
│   └── routing.py                  # Risk-weighted Dijkstra / alternative routing
│
├── models/                         # Serialized Model Artifacts & Schemas
│   ├── risk_model.json             # Trained XGBoost model
│   ├── feature_columns.json        # Ordered feature schema
│   ├── state_encoder.json          # State categorical mapping
│   └── feature_importance.png      # Feature importance chart
│
├── data/                           # Datasets & Geotechnical Records
│   ├── data.csv                    # Primary training dataset (423,249 records)
│   └── raw/                        # Raw geospatial datasets
│       ├── segment_coords.csv      # Real Northeast road coordinates
│       ├── segment_attributes.csv  # Elevation, slope, curvature attributes
│       └── road_incidents.csv      # Historical landslide/flood records
│
├── frontend/                       # React 19 + TypeScript + Vite Application
│   ├── public/                     # Static assets (favicon, icons)
│   ├── src/
│   │   ├── assets/                 # Local images (field incident reports)
│   │   ├── components/             # Reusable UI & Radix/Shadcn primitives
│   │   ├── data/                   # Client-side static seeds & mock data
│   │   ├── hooks/                  # React hooks (useSimulation, useMapMode)
│   │   ├── lib/                    # API client, i18n localization, utils, role auth
│   │   ├── routes/                 # TanStack Router file-based routes
│   │   ├── router.tsx              # Router instantiation
│   │   ├── routeTree.gen.ts        # Auto-generated route tree
│   │   └── styles.css              # Tailwind CSS v4 & custom tokens
│   ├── package.json                # Frontend dependencies
│   ├── package-lock.json           # npm lockfile
│   ├── tsconfig.json               # TypeScript configuration
│   └── vite.config.ts              # Vite + TanStack Start configuration
│
├── notebooks/                      # Data science exploration & EDA
│   └── .gitkeep
│
├── scripts/                        # Automated Runners
│   ├── run.bat                     # Unified one-click runner for backend & frontend
│   ├── start-backend.bat           # Dedicated backend launcher
│   └── start-frontend.bat          # Dedicated frontend launcher
│
├── run.bat                         # Root convenience launcher shortcut
├── requirements.txt                # Python backend & ML dependencies
├── package.json                    # Root monorepo runner scripts
├── .gitignore                      # Single consolidated master .gitignore
├── LICENSE                         # Project license (MIT)
└── README.md                       # Master documentation
```

---

## 🚀 Quick Start Guide

> For comprehensive execution instructions and troubleshooting tips, see the [RUN.md](RUN.md) guide.

### Prerequisites
- **Python**: Version 3.10 or higher
- **Node.js**: Version 18 or higher (LTS recommended)
- **npm**: Version 9 or higher

### Option 1: One-Click Launch (Windows)
Double-click `run.bat` or run:
```cmd
run.bat
```
This automatically verifies dependencies and starts:
- **Backend API**: `http://localhost:5050`
- **Frontend Dashboard**: `http://localhost:3000` (or `5173`)

### Option 2: Manual Step-by-Step Setup

#### 1. Backend Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start Flask API server
python backend/app.py
```
*API will be available at `http://localhost:5050`.*

#### 2. Frontend Setup
```bash
# In a new terminal, install frontend dependencies
npm --prefix frontend install

# Launch frontend dev server
npm run dev
```
*Dashboard will open in your browser.*

---

## 📊 Model Evaluation & Coverage

| State | Capital | Key Corridors Monitored | Accuracy |
|:---|:---|:---|:---:|
| **Arunachal Pradesh** | Itanagar | NH-13, Trans-Arunachal Hwy, NH-313 | 84.7% |
| **Assam** | Dispur | NH-27, NH-15, NH-17, NH-37 | 88.7% |
| **Manipur** | Imphal | NH-2, NH-37, NH-102, NH-150 | 86.0% |
| **Meghalaya** | Shillong | NH-6, NH-44, NH-40, NH-106 | 88.4% |
| **Mizoram** | Aizawl | NH-54, NH-54A, NH-302 | 84.0% |
| **Nagaland** | Kohima | NH-2, NH-29A, NH-702 | 84.5% |
| **Tripura** | Agartala | NH-8, NH-44, NH-44A | 88.8% |
| **Sikkim** | Gangtok | NH-10, NH-717A, NH-31A | 85.0% |

- **Total Dataset Size**: 423,249 observations (579 segments × 731 days).
- **Primary Danger Factor**: 3-Day Cumulative Precipitation × Slope Gradient interaction (`rain3_slope_interaction`).

---

## 📡 API Reference

| Endpoint | Method | Description |
|:---|:---:|:---|
| `/api/health` | `GET` | Health status and ML engine connectivity verification |
| `/api/segments` | `GET` | Road segment records with live risk scores and geographic bounds |
| `/api/assess-route` | `POST` | Route risk assessment comparing shortest vs. safest alternatives |
| `/api/incidents` | `GET` | Historical and simulated incident catalog |
| `/api/corridors` | `GET` | Critical logistics corridors with real-time status and throughput delays |
| `/api/alerts` | `GET` | High-priority road safety alerts and warnings |
| `/api/districts` | `GET` | District-level vulnerability index and risk distribution |
| `/api/stats` | `GET` | Overall network summary statistics |
| `/api/stream-telemetry`| `GET` | Server-Sent Events (SSE) telemetry stream for real-time map updates |
| `/api/reports` | `GET/POST`| Field incident reporting and verification |

---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
