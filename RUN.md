# How to Run the Road Risk Analyzer Website

Welcome to the **Manipur Road Risk Analyzer Dashboard** (`ManipurRiskAI`).

---

## ⚡ Quick Start (1 Simple Command)

You do **NOT** need Node.js, `npm`, or Vite. The application is built using modern vanilla HTML5/CSS3/JavaScript (ES Modules) served directly by a lightweight Python Flask server.

### Option A: Using the One-Click Launcher (Windows)
Double-click `run.bat` in this directory, or run in PowerShell / Command Prompt:
```powershell
.\run.bat
```
This will automatically launch the server and open your default web browser to [http://localhost:5050](http://localhost:5050).

---

### Option B: Manual Command Line (Recommended)

1. **Open PowerShell or Terminal** in the project root directory:
   ```powershell
   cd "c:\Users\User\Documents\complete Road risk analyzer\road-risk-ml"
   ```

2. **Install requirements** (if not already installed):
   ```powershell
   python -m pip install -r requirements.txt
   python -m pip install flask flask-cors
   ```

3. **Start the application**:
   ```powershell
   python frontend\api\app.py
   ```

4. **Open your browser** to:
   ```
   http://localhost:5050
   ```

That's it! Both the frontend website and the backend ML API are running together at **`http://localhost:5050`**.

---

## ⚠️ Why Did Previous Commands Fail?

| Attempted Command | Why It Failed | Correct Way |
|---|---|---|
| `python app.js` | `app.js` is a **JavaScript file** for the web browser, not a Python script. Python cannot execute JavaScript. | Run `python frontend\api\app.py` |
| `npm run dev` | There is **no Node.js / `package.json`**. This project avoids Node build dependencies and uses native browser ES Modules. | Run `python frontend\api\app.py` |
| Double clicking `index.html` (`file:///...`) | Modern browsers block ES module imports (`import ... from "./api.js"`) on local `file://` protocol due to browser CORS security. | Serve via HTTP by running `app.py` and opening `http://localhost:5050` |

---

## 🌐 Advanced: Running Frontend and Backend Separately

If you prefer to run the backend and frontend on two independent ports:

### Terminal 1 — Backend API (Port 5050)
```powershell
cd "road-risk-ml"
python frontend\api\app.py
```
*API Base URL:* `http://localhost:5050/api`  
*Health Check:* `http://localhost:5050/api/status`

### Terminal 2 — Frontend Static Server (Port 8000)
```powershell
cd "road-risk-ml\frontend"
python -m http.server 8000
```
*Website URL:* `http://localhost:8000`

Because CORS is enabled on the Flask backend, the frontend on port 8000 can communicate with the backend on port 5050 seamlessly.

---

## 🗺️ Dashboard Screens & Features Available

Once open at [http://localhost:5050](http://localhost:5050), explore the navigation bar at the top:

1. **Dashboard Overview**
   - KPI Summary: Active alerts, blocked roads count, vehicles in transit, safe routes.
   - District-wise connectivity list (Green / Yellow / Red badges).
   - Quick action shortcuts.

2. **GIS Accessibility Map**
   - Interactive Leaflet map of Manipur with color-coded road segments (Open, Caution, Blocked).
   - Real-time weather, landslide, and flood overlays.
   - Clickable segments showing road condition, elevation slope, and delay estimation.

3. **Safe Route Planner**
   - Select Origin & Destination across Manipur districts.
   - Set risk tolerance threshold and vehicle type (Ambulance, Heavy Truck, Light Vehicle).
   - Generates primary safe route + alternate evacuation detour.

4. **Vehicle Tracking**
   - Live simulated transit fleet with driver info, cargo, speed, and GPS coordinates.
   - Interactive vehicle markers on the map.

5. **Live Alerts & SSE**
   - Real-time alerts feed with audio notifications, filterable by severity (Critical, High, Medium, Info).

6. **Citizen Field Reports**
   - Crowdsourced hazard submission form (potholes, landslides, waterlogging, roadblocks).

7. **ML Analytics**
   - Historical hazard trends, risk distribution charts, model accuracy metrics, and CSV/PDF export.

---

## 🛠️ Troubleshooting

### 1. `Address already in use` or Port 5050 Conflict
If port 5050 is already in use by a background process, run in PowerShell:
```powershell
Get-NetTCPConnection -LocalPort 5050 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```
Then rerun `python frontend\api\app.py`.

### 2. Missing Packages
If you get `ModuleNotFoundError: No module named 'flask'`:
```powershell
python -m pip install flask flask-cors pandas joblib scikit-learn
```

### 3. ML Model Status
When `frontend\api\app.py` starts, it will report:
```
=======================================================
  ManipurRiskAI -- REST API Server
  ML Model: OK Loaded
  Dataset:  OK Loaded
  Running at http://localhost:5050
=======================================================
```
If the ML model `.joblib` file is not present, it will automatically fall back to synthetic risk scores without crashing.
