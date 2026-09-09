# Using Real Data with the Road Risk ML Model
# Data Source Stack Guide

## Your API Stack — Validation & Role

Your chosen sources are **all correct**. Here is how each one fits into the pipeline:

| Source | Role in This Project | Feeds Column(s) |
|--------|---------------------|-----------------|
| **Bhuvan (ISRO)** | GIS base layer — slope, rivers, landslide zones | `slope_degrees`, `distance_to_river_km`, `past_landslide_count` |
| **OpenStreetMap** | Road segment geometries + IDs | `road_segment_id` |
| **IMD** | Historical daily rainfall (ground truth weather) | `rainfall_mm` |
| **Open-Meteo** | Free REST API for rainfall (easier than IMD for code) | `rainfall_mm` |
| **Sentinel imagery** | Detect actual road blockages from satellite | `road_blocked` label |
| **OSRM** | ⚠️ NOT for training — used **after** the model to suggest alternate routes | Output layer only |
| **data.gov.in** | Government incident/closure records | `road_blocked` label |
| **NHAI portal** | NH segment data + official closure logs | `road_segment_id`, `road_blocked` |
| **DoNER portal** | NE India road connectivity + blockage reports | `road_segment_id`, `road_blocked` |

> **Note on OSRM:** OSRM is the right tool for routing, but it belongs in your **API response layer** — 
> your app calls the ML model → gets risk score → if high, calls OSRM to compute an alternate route.
> It does not feed training data.

---

## What Your Final CSV Must Look Like

```
date,road_segment_id,rainfall_mm,rainfall_last_3_days,slope_degrees,distance_to_river_km,past_landslide_count,season,road_blocked
2024-06-01,NH-44-KM12,38.5,95.0,32.0,1.8,5,monsoon,1
2024-06-01,NH-44-KM15,38.5,95.0,10.0,12.5,0,monsoon,0
2024-01-15,NH-44-KM12,1.2,3.0,32.0,1.8,5,winter,0
```

---

## Step-by-Step Data Collection

---

### Step 1 — Road Segments (OpenStreetMap + NHAI/DoNER)

Use OSM to get road geometries and assign segment IDs.

**Install the OSM library:**
```bash
pip install osmnx geopandas
```

**Fetch road network for your area:**
```python
import osmnx as ox
import geopandas as gpd

# Replace with your region of interest
G = ox.graph_from_place("Manipur, India", network_type="drive")
edges = ox.graph_to_gdfs(G, nodes=False)

# Assign segment IDs
edges = edges.reset_index()
edges["road_segment_id"] = ["SEG" + str(i).zfill(4) for i in range(len(edges))]

# Save segment centroids (lat/lon) — needed for weather API calls
edges["centroid_lat"] = edges.geometry.centroid.y
edges["centroid_lon"] = edges.geometry.centroid.x

segment_coords = edges[["road_segment_id", "centroid_lat", "centroid_lon"]].drop_duplicates()
segment_coords.to_csv("data/segment_coords.csv", index=False)
print(f"Saved {len(segment_coords)} road segments")
```

> **NHAI / DoNER:** Download the official road shapefiles from  
> - NHAI: https://www.nhai.gov.in → GIS portal  
> - DoNER: https://doner.gov.in → connectivity projects  
> Use these as the authoritative segment IDs for National Highways in NE India.

---

### Step 2 — Slope & River Distance (Bhuvan / ISRO)

**Bhuvan provides:**
- DEM (Digital Elevation Model) → compute slope in degrees
- River network layers → compute distance to nearest river
- Landslide hazard zones → historical landslide count

**Access Bhuvan WMS/WFS layers:**
```
URL: https://bhuvan-vec1.nrsc.gov.in/bhuvan/wms
Layers: lulc, dem, rivers, landslide_zones
```

**Compute slope from DEM using rasterio:**
```bash
pip install rasterio numpy scipy
```

```python
import numpy as np
import rasterio
from rasterio.warp import reproject

# Load DEM .tif downloaded from Bhuvan
with rasterio.open("data/bhuvan_dem.tif") as src:
    dem = src.read(1).astype(float)
    res = src.res  # pixel resolution in degrees

# Compute slope in degrees
dy, dx = np.gradient(dem, res[0], res[1])
slope_rad = np.arctan(np.sqrt(dx**2 + dy**2))
slope_deg = np.degrees(slope_rad)

print(f"Slope range: {slope_deg.min():.1f} to {slope_deg.max():.1f} degrees")
```

**Sample slope for each road segment:**
```python
import geopandas as gpd
import rasterio
from rasterio.sample import sample_gen

segments = gpd.read_file("data/road_segments.shp")

with rasterio.open("data/slope.tif") as src:
    coords = [(geom.centroid.x, geom.centroid.y) for geom in segments.geometry]
    segments["slope_degrees"] = [v[0] for v in src.sample(coords)]

segments.to_csv("data/segment_attributes.csv", index=False)
```

**Compute distance to nearest river:**
```python
from shapely.ops import nearest_points
import geopandas as gpd

segments = gpd.read_file("data/road_segments.shp").to_crs(epsg=32644)  # UTM zone for India
rivers   = gpd.read_file("data/bhuvan_rivers.shp").to_crs(epsg=32644)

river_union = rivers.geometry.unary_union

segments["distance_to_river_km"] = segments.geometry.centroid.apply(
    lambda pt: pt.distance(river_union) / 1000  # meters to km
)
```

---

### Step 3 — Daily Rainfall (Open-Meteo API)

Open-Meteo is **free, no API key required**, and supports historical data back to 1940.  
It's easier to use than IMD for programmatic access.

**API endpoint:**
```
https://archive-api.open-meteo.com/v1/archive
  ?latitude={lat}
  &longitude={lon}
  &start_date=2024-01-01
  &end_date=2025-12-31
  &daily=precipitation_sum
  &timezone=Asia/Kolkata
```

**Fetch rainfall for all road segments:**
```bash
pip install requests
```

```python
import requests
import pandas as pd
import time

segment_coords = pd.read_csv("data/segment_coords.csv")
all_records = []

for _, row in segment_coords.iterrows():
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude":       row["centroid_lat"],
        "longitude":      row["centroid_lon"],
        "start_date":     "2024-01-01",
        "end_date":       "2025-12-31",
        "daily":          "precipitation_sum",
        "timezone":       "Asia/Kolkata",
    }
    resp = requests.get(url, params=params, timeout=30)
    data = resp.json()["daily"]

    for date, rain in zip(data["time"], data["precipitation_sum"]):
        all_records.append({
            "date":              date,
            "road_segment_id":   row["road_segment_id"],
            "rainfall_mm":       rain or 0.0,
        })

    time.sleep(0.1)  # be polite to the API

rainfall_df = pd.DataFrame(all_records)
rainfall_df["date"] = pd.to_datetime(rainfall_df["date"])
rainfall_df.to_csv("data/rainfall_raw.csv", index=False)
print(f"Fetched {len(rainfall_df):,} rainfall records")
```

> **IMD as backup / cross-validation:**  
> Download district-wise daily rainfall from https://mausam.imd.gov.in → Data Services  
> Use IMD data to validate Open-Meteo values for your region.

---

### Step 4 — Road Blockage Labels (data.gov.in / NHAI / DoNER / Sentinel)

This is the most important column — without `road_blocked` labels, the model cannot train.

#### Source A — data.gov.in
```
Search: "road accident" OR "road closure" OR "landslide"
URL: https://data.gov.in/search?title=road+blockage
```
Download the CSV and map to your segment IDs by matching location names or coordinates.

#### Source B — NHAI Incident Reports
```
URL: https://www.nhai.gov.in → Citizen Corner → Complaint/Feedback
Historical closure data can be requested via RTI (Right to Information Act)
```

#### Source C — DoNER Portal (NE India specific)
```
URL: https://doner.gov.in → Projects → Road Connectivity
Contains blockage records for PMGSY and BRO roads in Assam, Manipur, Meghalaya etc.
```

#### Source D — Sentinel-1 SAR Imagery (most accurate, most complex)

Sentinel-1 radar imagery can detect flooded/blocked roads even through clouds.

```python
# Using Google Earth Engine Python API (requires free signup)
# pip install earthengine-api
import ee
ee.Initialize()

# Load Sentinel-1 SAR data
s1 = (ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(ee.Geometry.Rectangle([92.0, 23.5, 97.0, 28.5]))  # NE India bbox
        .filterDate("2024-06-01", "2024-09-30")
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .select("VV"))

# Low VV backscatter = water/flood = potential road blockage
# This requires additional processing to extract per-road-segment labels
# Use NDWI or flood mapping algorithms from: https://developers.google.com/earth-engine/tutorials
```

> ⚠️ **Sentinel imagery is advanced.** If you're starting out, use data.gov.in + NHAI records first.  
> Add Sentinel-based labels later to improve `road_blocked` accuracy.

---

### Step 5 — Assemble Final Dataset

```python
import pandas as pd

# Load all pieces
rainfall    = pd.read_csv("data/rainfall_raw.csv", parse_dates=["date"])
seg_attrs   = pd.read_csv("data/segment_attributes.csv")   # slope, river dist, landslide
incidents   = pd.read_csv("data/road_incidents.csv")        # date, road_segment_id, road_blocked

# Merge rainfall + segment attributes
df = rainfall.merge(seg_attrs[["road_segment_id", "slope_degrees",
                                "distance_to_river_km", "past_landslide_count"]],
                    on="road_segment_id", how="left")

# Compute 3-day rolling rainfall per segment
df = df.sort_values(["road_segment_id", "date"])
df["rainfall_last_3_days"] = (
    df.groupby("road_segment_id")["rainfall_mm"]
    .transform(lambda x: x.rolling(3, min_periods=1).sum())
)

# Derive season
def to_season(month):
    if month in (6, 7, 8, 9):  return "monsoon"
    if month in (12, 1, 2):    return "winter"
    return "summer"

df["season"] = df["date"].dt.month.map(to_season)

# Attach road_blocked labels
df = df.merge(incidents[["date", "road_segment_id", "road_blocked"]],
              on=["date", "road_segment_id"], how="left")
df["road_blocked"] = df["road_blocked"].fillna(0).astype(int)

# Final column order
final_cols = [
    "date", "road_segment_id", "rainfall_mm", "rainfall_last_3_days",
    "slope_degrees", "distance_to_river_km", "past_landslide_count",
    "season", "road_blocked"
]
df[final_cols].to_csv("data/data.csv", index=False)
print(f"Final dataset: {len(df):,} rows | blocked rate: {df['road_blocked'].mean():.3f}")
```

---

### Step 6 — Run Training (unchanged)

```bash
python src/train_model.py
```

No changes to `train_model.py` needed — it reads `data/data.csv` regardless of source.

---

## How OSRM Fits In (Application Layer)

OSRM does **not** feed training data. It is called **after** your model returns a prediction:

```
User requests route A → B
        │
        ▼
For each road segment on the route:
  call predict_risk(segment_features) → risk_probability
        │
        ▼
  If risk_probability > 0.6:
    call OSRM to find alternate route avoiding that segment
        │
        ▼
Return safe route to user
```

**OSRM API example (route + avoid blocked segment):**
```python
import requests

def get_safe_route(origin_lon, origin_lat, dest_lon, dest_lat):
    url = (
        f"http://router.project-osrm.org/route/v1/driving/"
        f"{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
        f"?overview=full&geometries=geojson"
    )
    resp = requests.get(url)
    return resp.json()["routes"][0]
```

> You can also run OSRM locally with your own OSM extract for offline use:  
> https://hub.docker.com/r/osrm/osrm-backend

---

## Data Quality Checklist

Run this before training:

```python
import pandas as pd

df = pd.read_csv("data/data.csv")
required = ["date","road_segment_id","rainfall_mm","rainfall_last_3_days",
            "slope_degrees","distance_to_river_km","past_landslide_count",
            "season","road_blocked"]

print("=== Data Validation ===")
print(f"Rows           : {len(df):,}")
print(f"Missing cols   : {set(required) - set(df.columns)}")
print(f"Null counts    :\n{df[required].isnull().sum()}")
print(f"Season values  : {df['season'].unique()}")
print(f"Target balance : {df['road_blocked'].value_counts().to_dict()}")
print(f"Date range     : {df['date'].min()} to {df['date'].max()}")
print(f"Segments       : {df['road_segment_id'].nunique()} unique")
```

---

## Full Checklist

### Data Collection
- [ ] Download road segment shapefiles (OSM / NHAI / DoNER)
- [ ] Extract slope from Bhuvan DEM
- [ ] Compute distance to river from Bhuvan river layer
- [ ] Pull historical landslide count from NRSC Landslide Atlas
- [ ] Fetch daily rainfall from Open-Meteo API (per segment centroid)
- [ ] Download road blockage records from data.gov.in / NHAI / DoNER

### Data Preparation
- [ ] Compute `rainfall_last_3_days` (rolling sum per segment)
- [ ] Derive `season` from date
- [ ] Merge all sources into one CSV with 9 required columns
- [ ] Run validation script — zero nulls, correct season values
- [ ] Save as `data/data.csv`

### Training
- [ ] Run `python src/train_model.py`
- [ ] Check F1 > 0.75 on the blocked class
- [ ] Review SHAP plot — top features should make physical sense

### Application
- [ ] Wire `predict_risk()` into your REST API
- [ ] Call OSRM for alternate routing when risk > threshold
