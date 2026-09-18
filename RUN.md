# How to Run NorthEastRiskAI

This guide provides instructions on running both the **Backend API** and the **Frontend Dashboard**.

---

> [!IMPORTANT]
> **Directory Update Notice:**
> Following the recent project restructuring, the frontend has moved:
> - **New Frontend Directory:** `SIH-prototype-level-02/frontend/`
> - *(The old `road-risk-ml/frontend-UI` folder has been removed).*
>
> If your terminal is still pointing to the old folder, close that terminal tab and open a new terminal in `SIH-prototype-level-02` or `SIH-prototype-level-02/frontend`.

---

## ⚡ Method 1: One-Click Launch (Recommended for Windows)

In the root of the project (`SIH-prototype-level-02`), double-click **`scripts/run.bat`** or execute it in PowerShell / Command Prompt:

```cmd
scripts\run.bat
```

### What `run.bat` does automatically:
1. Detects Node.js and Python on your system.
2. Checks and installs required Python backend packages from `requirements.txt`.
3. Launches the **Backend API Server** on port `5050` in a separate terminal.
4. Checks and installs frontend dependencies (if `node_modules` is not present).
5. Launches the **Vite Frontend Dev Server** in a separate terminal.

---

## 🛠️ Method 2: Running Services Manually (Two Terminals)

If you prefer to start the backend and frontend separately in two terminal windows:

### Terminal 1 — Start the Python Backend API (Port 5050)

```bash
# 1. Navigate to the repository root
cd "SIH-prototype-level-02"

# 2. Install backend dependencies (first time only)
pip install -r requirements.txt

# 3. Start the Flask API server
python backend/app.py
```

*The backend server will start at:* **`http://localhost:5050`**  
*Verify it is running by checking:* **`http://localhost:5050/api/health`**

---

### Terminal 2 — Start the Frontend Dashboard (Port 3000 / 8080)

```bash
cd "SIH-prototype-level-02/frontend"

# Install dependencies (if not already installed)
npm install

# Start Vite dev server
npm run dev
```

*Open your browser at the URL shown in the terminal:* **`http://localhost:8080`** *(or `http://localhost:3000`)*.

---

## 🌐 Default Ports & Access Points

| Service | Address | Description |
|:---|:---|:---|
| **Frontend Web App** | `http://localhost:8080` | Full GIS accessibility dashboard, route simulator & alerts |
| **Backend REST API** | `http://localhost:5050` | Flask server handling ML inference, OSRM routing & real data |
| **API Health Check** | `http://localhost:5050/api/health` | Verifies ML engine and dataset connectivity |
| **Telemetry Stream** | `http://localhost:5050/api/stream/alerts` | Live SSE stream for real-time map updates |

---

## 🔧 Production Build

To build the optimized static production bundle for the frontend:

```bash
# From repository root:
npm run build

# To preview the production build locally:
npm run preview
```

To run the backend with a production WSGI server (e.g. Waitress on Windows):
```bash
pip install waitress
waitress-serve --port=5050 backend.wsgi:app
```

---

## 🚀 Free Cloud Deployment

Looking to host NorthEastRiskAI on the cloud for free?  
See the full guide in [deployment.md](file:///c:/Users/User/Documents/SIH%20final/SIH-prototype-level-02/deployment.md) covering:
- **Vercel + Render** (Recommended free dual stack)
- **Hugging Face Spaces** (16GB RAM free all-in-one container)
- **Koyeb + Netlify** (Fast, always-on alternative)
- **Cloudflare Quick Tunnels** (Instant live link for hackathon evaluations in 10s)

---

## ❓ Troubleshooting & FAQs

### 1. "Could not determine Node.js install directory"
- **Cause:** Your terminal is open in a directory that was deleted or moved (`road-risk-ml/frontend-UI`).
- **Fix:** Open a fresh terminal tab in `SIH-prototype-level-02/frontend` or `SIH-prototype-level-02`, then re-run `npm run dev`.

### 2. "Python not recognized" or "npm not recognized"
- Ensure Python and Node.js are added to your system `PATH`.
- In Windows, standard install locations are:
  - Node.js: `C:\Program Files\nodejs`
  - Python: `C:\Users\<YourUser>\AppData\Local\Programs\Python\Python311` (or Python312)
- Running `run.bat` automatically includes standard Node.js directories in the PATH for that session.

### 3. "ML Backend Offline" banner in the frontend
- Verify Terminal 1 is running `python backend/app.py` and listening on port `5050`.
- Visit `http://localhost:5050/api/health` in your browser. If it returns `{"status": "online"}`, the frontend will automatically connect and display the green **"Python ML Engine Connected"** indicator.

### 4. Port 5050 already in use
- If port 5050 is busy, terminate existing Python instances or check running tasks:
  ```powershell
  Get-Process python -ErrorAction SilentlyContinue | Stop-Process
  ```
