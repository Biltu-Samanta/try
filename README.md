# SIH2026 - Road Accessibility Risk Intelligence & Predictive Routing

An AI/ML-driven solution for real-time road accessibility, blockage risk assessment (landslides, floods, extreme monsoon weather), and safe alternative routing.

## 🚀 Key Highlights
- **Geospatial & Terrain Analysis:** Multi-source integration of elevation (SRTM DEM), slope, curvature, geological attributes, and road curvature.
- **Dynamic Weather Monitoring:** Live and forecast rainfall data (Open-Meteo) combined with historical precipitation patterns.
- **Machine Learning Core:** XGBoost gradient boosted risk classifier trained on regional incident patterns and geotechnical features.
- **Alternative Routing Engine:** Network-based pathfinder dynamically weighting road segments based on real-time risk scores.
- **Modern Interactive Dashboard:** Web application with 3D/ambient visualization, interactive route simulator, and operational insights.

## 📁 Repository Structure
- `road-risk-ml/`: Complete ML pipeline, dataset generation, model training, FastAPI backend, and frontend interface.
- `PROJECT_OVERVIEW.md`: Detailed architecture, schema documentation, and pipeline specs.
- `RUN.md`: Instructions for running the backend and frontend services.
- `techstack.md`: Tech stack breakdown and dependencies.
- `FEASIBILITY AND VIABILITY.md`: Project viability and field deployment analysis.

## ⚡ Quick Start
See [RUN.md](RUN.md) for full instructions on setting up the environment, installing dependencies, and launching the services.
