# 🚀 NorthEastRiskAI — Free Cloud Deployment Guide

This guide details how to deploy the entire **NorthEastRiskAI** full-stack platform (Python Flask ML API + React Vite GIS Dashboard) **100% free of charge**, with no credit card required.

---

## 📑 Table of Contents
1. [Architecture Overview](#-architecture-overview)
2. [Free Hosting Options Comparison](#-free-hosting-options-comparison)
3. [Method 1: Vercel + Render (Recommended)](#-method-1-vercel--render-recommended)
   - [Part A: Deploy Python ML Backend on Render](#part-a-deploy-python-ml-backend-on-render)
   - [Part B: Deploy Frontend on Vercel](#part-b-deploy-frontend-on-vercel)
4. [Method 2: Hugging Face Spaces (All-in-One 16GB RAM Docker)](#-method-2-hugging-face-spaces-all-in-one-16gb-ram)
5. [Method 3: Koyeb + Netlify (Always-On Alternative)](#-method-3-koyeb--netlify-alternative)
6. [Method 4: Instant Live Demo via Cloudflare Tunnels (Zero Setup)](#-method-4-instant-live-demo-via-cloudflare-tunnels-best-for-hackathon-juries)
7. [Environment Variables Reference](#-environment-variables-reference)
8. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🏗️ Architecture Overview

The system consists of two decoupled components:

```
┌────────────────────────────────────────────────────────┐
│               React 19 + Vite Frontend                 │
│         (Hosted on Vercel / Netlify / HF Spaces)       │
│  - MapLibre & Leaflet GIS Mapping                      │
│  - Real-time simulation & route inspector UI           │
│  - Connects via: VITE_API_BASE_URL                     │
└───────────────────────────┬────────────────────────────┘
                            │ REST APIs + Server-Sent Events (SSE)
┌───────────────────────────▼────────────────────────────┐
│              Flask + Gunicorn ML Backend               │
│             (Hosted on Render / Koyeb / HF)            │
│  - Trained XGBoost model (`models/risk_model.json`)    │
│  - Pre-cached road segment network (`data/`)           │
│  - Real-time OSRM route hazard engine                  │
│  - REST endpoints at `/api/*`                          │
└────────────────────────────────────────────────────────┘
```

> [!TIP]
> **Why `requirements-prod.txt`?**  
> We created [requirements-prod.txt](file:///c:/Users/User/Documents/SIH%20final/SIH-prototype-level-02/requirements-prod.txt) specifically for cloud deployments. It omits heavy GIS preprocessing compilation libraries (like GDAL and rasterio) that can crash free cloud tiers with build timeouts, while preserving all runtime ML inference, pandas, XGBoost, and Flask dependencies.

---

## ⚖️ Free Hosting Options Comparison

| Provider / Stack | Free Tier Specs | Credit Card? | Best For |
|:---|:---|:---|:---|
| **Vercel (Frontend) + Render (Backend)** | 100 GB Bandwidth + 512MB RAM Web Service | ❌ No | **Top Choice** — Clean separation, global edge CDN, automated CI/CD |
| **Hugging Face Spaces** | **16 GB RAM + 2 vCPU** (Docker) | ❌ No | **AI/ML Powerhouse** — Best for running heavy pandas/ML pipelines without memory bottlenecks |
| **Koyeb (Backend) + Netlify (Frontend)** | 512MB RAM Nano Instance (Always On) | ❌ No | Good alternative if Render cold starts are undesirable |
| **Cloudflare Quick Tunnel** | Unlimited local-to-cloud tunnel | ❌ No | **Hackathon Live Demos** — Present your local build directly to judges in 10 seconds |

---

## 🌟 Method 1: Vercel + Render (Recommended)

This gives you a fast global CDN for your UI and an automated Python backend.

### Part A: Deploy Python ML Backend on Render

1. **Sign Up**: Go to [render.com](https://render.com) and create a free account with GitHub.
2. **Push Repository**: Ensure your project is pushed to a GitHub repository (public or private).
3. **Create New Web Service**:
   - Click **New +** → **Web Service**.
   - Select your GitHub repository.
4. **Configure the Service**:
   - **Name**: `northeast-risk-ai-api` *(or any unique name)*
   - **Region**: Choose closest to you (e.g., `Singapore` or `Frankfurt`)
   - **Branch**: `main` (or your active branch)
   - **Root Directory**: Leave blank (root)
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r requirements-prod.txt
     ```
   - **Start Command**:
     ```bash
     gunicorn -w 2 -b 0.0.0.0:$PORT backend.wsgi:app
     ```
   - **Instance Type**: **Free** (512 MB RAM, 0.1 CPU)
5. **Add Environment Variables**:
   Under **Advanced** → **Environment Variables**, add:
   - `PYTHON_VERSION` = `3.11.8`
6. **Deploy**:
   - Click **Create Web Service**.
   - Deployment takes ~2 minutes.
   - When finished, Render gives you a public URL (e.g., `https://northeast-risk-ai-api.onrender.com`).
7. **Verify Backend**:
   Open in your browser:
   ```
   https://northeast-risk-ai-api.onrender.com/api/health
   ```
   You should see:
   ```json
   {
     "status": "online",
     "service": "NorthEastRiskAI REST API",
     "ml_engine": true
   }
   ```

> [!NOTE]
> **Preventing Render Inactivity Sleep (Cold Starts):**  
> Free Render instances sleep after 15 minutes of inactivity (taking ~45s to wake up on first load).  
> To keep it warm 24/7 for free:  
> 1. Sign up for a free monitor at [cron-job.org](https://cron-job.org) or [uptimerobot.com](https://uptimerobot.com).  
> 2. Set an HTTP GET request to `https://your-backend.onrender.com/api/health` every **10 minutes**.

---

### Part B: Deploy Frontend on Vercel

1. **Sign Up**: Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Import Project**:
   - Click **Add New...** → **Project**.
   - Select your GitHub repository.
3. **Configure Project Settings**:
   - **Framework Preset**: `Vite` (or `Other`)
   - **Root Directory**: Click **Edit** and select: `frontend`
   - **Build and Output Settings**:
     - Build Command: `npm run build`
     - Output Directory: `.output/public` *(or leave default `dist`)*
     - Install Command: `npm install`
4. **Configure Environment Variables**:
   Add the following under **Environment Variables**:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://your-backend.onrender.com` *(replace with your actual Render URL from Part A)*
5. **Deploy**:
   - Click **Deploy**.
   - Within 1–2 minutes, your dashboard will be live at `https://your-project.vercel.app`.
6. **Confirm Connection**:
   - Open your Vercel URL.
   - The top status bar will display a green pulsing badge:  
     **`Python ML Engine Connected`**!

---

## ⚡ Method 2: Hugging Face Spaces (All-in-One 16GB RAM)

Hugging Face Spaces offers **16 GB RAM + 2 vCPUs completely free forever** without cold sleep. This repository includes a ready-to-use [Dockerfile](file:///c:/Users/User/Documents/SIH%20final/SIH-prototype-level-02/Dockerfile).

### Steps:
1. Create an account at [huggingface.co](https://huggingface.co).
2. Go to **Spaces** → **Create new Space**.
3. Fill in the details:
   - **Space Name**: `northeast-risk-ai`
   - **License**: `mit`
   - **Space SDK**: Choose **Docker** → **Blank**.
   - **Space Hardware**: **Free (CPU basic · 2 vCPU · 16 GB RAM)**.
4. Clone the space or push your repository:
   ```bash
   git remote add space https://huggingface.co/spaces/YOUR_USERNAME/northeast-risk-ai
   git push space main
   ```
5. Hugging Face will automatically execute the multi-stage `Dockerfile`, build the frontend, install the ML model, and run the Gunicorn server on port 7860.
6. Your entire app and API will be accessible at:
   `https://YOUR_USERNAME-northeast-risk-ai.hf.space`

---

## 🌐 Method 3: Koyeb + Netlify (Alternative)

### Koyeb (Backend)
1. Sign up at [koyeb.com](https://www.koyeb.com).
2. Create App → GitHub Repo.
3. Builder: **Buildpack** (or **Dockerfile**).
4. Build Command: `pip install -r requirements-prod.txt`.
5. Run Command: `gunicorn -w 2 -b 0.0.0.0:$PORT backend.wsgi:app`.
6. Select **Nano** instance (Free).

### Netlify (Frontend)
1. Sign up at [netlify.com](https://www.netlify.com).
2. **Add new site** → **Import an existing project** from GitHub.
3. Base directory: `frontend`.
4. Build command: `npm run build`.
5. Publish directory: `frontend/.output/public` (or `frontend/dist`).
6. In **Site configuration** → **Environment variables**, set:
   - `VITE_API_BASE_URL` = `https://<your-koyeb-app>.koyeb.app`
7. Click **Deploy Site**.

---

## ⚡ Method 4: Instant Live Demo via Cloudflare Tunnels (Best for Hackathon Juries)

If you are presenting at a hackathon (e.g. Smart India Hackathon) and need a publicly accessible HTTPS link for judges **right now** without deploying to cloud servers:

1. Start your local services using `run.bat` or:
   ```bash
   # Terminal 1: Backend
   python backend/app.py

   # Terminal 2: Frontend
   cd frontend && npm run dev
   ```
2. Download the free Cloudflare Tunnel CLI (`cloudflared`):
   - **Windows (PowerShell)**:
     ```powershell
     winget install Cloudflare.cloudflared
     ```
3. Run an instant public tunnel to your frontend port:
   ```bash
   cloudflared tunnel --url http://localhost:8080
   ```
   *(Or port 3000 / 5173 depending on your local frontend port).*
4. Cloudflare outputs a public HTTPS link (e.g. `https://random-words.trycloudflare.com`).  
   **Anyone in the world can open this on their phone or laptop instantly!**

---

## 📋 Environment Variables Reference

### Frontend Environment Variables
Set these in Vercel / Netlify / `.env.production`:

| Variable | Description | Example |
|:---|:---|:---|
| `VITE_API_BASE_URL` | Full URL of your deployed Python backend | `https://northeast-risk-ai-api.onrender.com` |

### Backend Environment Variables
Set these in Render / Koyeb / Docker:

| Variable | Description | Default |
|:---|:---|:---|
| `PORT` | Web server listen port (auto-set by hosting platforms) | `5050` |
| `PYTHON_VERSION` | Python runtime version | `3.11.8` |

---

## ❓ Troubleshooting & FAQs

### 1. The dashboard says "Connecting to ML Backend..." or "ML Backend Offline"
- Ensure your backend service is running and healthy by navigating to `https://<backend-url>/api/health`.
- Verify that `VITE_API_BASE_URL` in Vercel matches your Render URL **without** a trailing slash (e.g., `https://my-api.onrender.com`, not `https://my-api.onrender.com/`).
- After updating environment variables on Vercel, trigger a **Redeploy** so the new build picks up the variable.

### 2. "Out of Memory (OOM)" during backend build on Render
- Ensure you used `requirements-prod.txt` instead of `requirements.txt`.
- `requirements-prod.txt` avoids memory-heavy GDAL and C-extensions compilation, keeping RAM usage under 180MB (well below the 512MB free tier cap).

### 3. Render Free Tier takes 50 seconds to respond
- Render spins down free web services after 15 minutes of inactivity. The first request after a sleep period wakes the container back up.
- Use a free ping service like [cron-job.org](https://cron-job.org) to ping `/api/health` every 10 minutes to keep it always awake.

### 4. CORS Errors in Browser Console
- CORS is pre-configured with `Flask-CORS` in [backend/app.py](file:///c:/Users/User/Documents/SIH%20final/SIH-prototype-level-02/backend/app.py) (`CORS(app)`), accepting requests from any origin. If you configure a custom domain, it will work seamlessly.

---

*NorthEastRiskAI — Built for Resilient Road Safety & Logistics Intelligence in Northeast India.*
