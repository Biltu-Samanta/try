"""
generate_data.py — Generate synthetic road accessibility risk dataset for
all 8 Northeast Indian states with realistic per-state correlations.

States:
  0 - Arunachal Pradesh
  1 - Assam
  2 - Manipur
  3 - Meghalaya
  4 - Mizoram
  5 - Nagaland
  6 - Tripura
  7 - Sikkim
"""
import json
import numpy as np
import pandas as pd
from pathlib import Path

np.random.seed(42)
rng = np.random.default_rng(42)

ROOT        = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data" / "data.csv"
ENC_PATH    = ROOT / "models" / "state_encoder.json"
(ROOT / "models").mkdir(parents=True, exist_ok=True)

START_DATE = "2024-01-01"
END_DATE   = "2025-12-31"

# ── State encoding map ──────────────────────────────────────────────────────────
STATE_ENC = {
    "Arunachal Pradesh": 0,
    "Assam":             1,
    "Manipur":           2,
    "Meghalaya":         3,
    "Mizoram":           4,
    "Nagaland":          5,
    "Tripura":           6,
    "Sikkim":            7,
}

# ── Per-state rainfall scale (exponential scale, mm/day, by month index 1-12) ──
# Meghalaya = wettest; Sikkim heavy pre-monsoon; Arunachal heavy monsoon
STATE_RAINFALL = {
    "Arunachal Pradesh": {1:2, 2:3, 3:6, 4:12, 5:25, 6:55, 7:70, 8:65, 9:45, 10:18, 11:5, 12:2},
    "Assam":             {1:2, 2:3, 3:7, 4:15, 5:22, 6:50, 7:60, 8:55, 9:40, 10:15, 11:4, 12:2},
    "Manipur":           {1:2, 2:2, 3:4, 4:8,  5:18, 6:45, 7:55, 8:50, 9:35, 10:12, 11:4, 12:2},
    "Meghalaya":         {1:3, 2:4, 3:9, 4:20, 5:40, 6:90, 7:110,8:95, 9:65, 10:25, 11:8, 12:3},
    "Mizoram":           {1:2, 2:3, 3:5, 4:10, 5:20, 6:48, 7:58, 8:52, 9:38, 10:14, 11:5, 12:2},
    "Nagaland":          {1:2, 2:3, 3:6, 4:11, 5:20, 6:46, 7:56, 8:50, 9:38, 10:14, 11:5, 12:2},
    "Tripura":           {1:2, 2:3, 3:5, 4:10, 5:18, 6:42, 7:52, 8:48, 9:35, 10:12, 11:4, 12:2},
    "Sikkim":            {1:2, 2:3, 3:8, 4:18, 5:45, 6:60, 7:65, 8:60, 9:42, 10:16, 11:5, 12:2},
}

# ── Per-state road corridors: (name, highway_type, s_lat, s_lon, e_lat, e_lon, n_segs) ──
STATE_CORRIDORS = {
    "Arunachal Pradesh": [
        ("Trans-Arunachal Hwy East",  "national_highway", 27.08, 93.61, 28.21, 97.23, 18),
        ("Trans-Arunachal Hwy West",  "national_highway", 27.08, 93.61, 27.50, 91.90, 12),
        ("NH-13 Itanagar-Ziro",       "national_highway", 27.10, 93.62, 27.55, 93.82,  8),
        ("NH-13 Ziro-Along",          "national_highway", 27.55, 93.82, 28.17, 94.80,  8),
        ("NH-313 Itanagar-Daporijo",  "national_highway", 27.10, 93.62, 27.98, 94.22,  8),
        ("Tawang Rd NH-13",           "national_highway", 27.08, 93.61, 27.59, 91.87, 10),
        ("Aalo-Pasighat Rd",          "primary",          28.17, 94.80, 28.07, 95.34,  5),
        ("Changlang-Tirap Rd",        "primary",          27.15, 95.62, 27.10, 96.12,  5),
        ("Dibang Valley Rd",          "secondary",        28.00, 95.54, 28.45, 96.20,  6),
        ("Lower Subansiri Rd",        "secondary",        27.55, 93.82, 27.20, 93.45,  5),
        ("Pakke-Kessang Rd",          "tertiary",         27.20, 92.80, 27.45, 93.40,  5),
        ("BRO Siang Valley",          "unclassified",     28.17, 94.80, 28.60, 95.20,  4),
        ("BRO Lohit District",        "unclassified",     28.00, 96.00, 27.80, 96.80,  4),
    ],
    "Assam": [
        ("NH-27 Guwahati-Dibrugarh",  "national_highway", 26.18, 91.75, 27.47, 94.91, 20),
        ("NH-17 Guwahati-Shillong",   "national_highway", 26.18, 91.75, 25.58, 91.88,  8),
        ("NH-15 Guwahati-Silchar",    "national_highway", 26.18, 91.75, 24.83, 92.80, 12),
        ("NH-37 Jorhat-Dibrugarh",    "national_highway", 26.75, 94.21, 27.47, 94.91,  7),
        ("NH-27 Dibrugarh-Tinsukia",  "national_highway", 27.47, 94.91, 27.49, 95.35,  5),
        ("NH-54 Silchar-Imphal Link",  "national_highway", 24.83, 92.80, 24.69, 93.12,  6),
        ("Kaziranga Ring Rd",          "primary",          26.57, 93.37, 26.75, 93.75,  5),
        ("Tezpur-Itanagar Link",       "primary",          26.63, 92.79, 27.08, 93.61,  6),
        ("Barak Valley Rd",            "primary",          24.83, 92.80, 24.50, 92.30,  5),
        ("Dhubri-Kokrajhar Rd",        "secondary",        26.02, 89.98, 26.40, 90.27,  4),
        ("Nagaon-Lumding Rd",          "secondary",        26.35, 92.68, 25.76, 93.17,  5),
        ("Goalpara-Bongaigaon",        "secondary",        26.17, 90.62, 26.48, 90.56,  4),
        ("Majuli Approach Rd",         "tertiary",         26.95, 94.15, 27.00, 94.22,  3),
        ("Dibru-Saikhowa Access",      "tertiary",         27.50, 95.35, 27.65, 95.60,  3),
    ],
    "Manipur": [
        ("NH-2 Imphal-Jiribam",        "national_highway", 24.82, 93.94, 24.68, 93.12, 15),
        ("NH-37 Imphal-Moreh",         "national_highway", 24.82, 93.94, 24.24, 94.27, 12),
        ("NH-102 Imphal-Ukhrul",       "national_highway", 24.82, 93.94, 25.13, 94.36,  8),
        ("NH-150 Imphal-Senapati",     "national_highway", 24.82, 93.94, 25.27, 93.97,  6),
        ("Imphal-Churachandpur",       "primary",          24.82, 93.94, 24.33, 93.68,  8),
        ("Imphal-Bishnupur",           "primary",          24.82, 93.94, 24.62, 93.76,  5),
        ("Thoubal Rd",                 "primary",          24.82, 93.94, 24.67, 93.99,  4),
        ("Kakching Rd",                "secondary",        24.67, 93.99, 24.49, 94.01,  4),
        ("Chandel Rd",                 "secondary",        24.33, 93.68, 24.06, 94.02,  5),
        ("Tamenglong Rd",              "secondary",        24.82, 93.94, 24.98, 93.41,  6),
        ("Noney Rd",                   "secondary",        24.82, 93.94, 24.78, 93.54,  4),
        ("Kangpokpi Rd",               "secondary",        25.27, 93.97, 25.39, 93.86,  3),
        ("Pherzawl Rd",                "tertiary",         24.33, 93.68, 24.18, 93.49,  4),
        ("Khengjoi Rd",                "tertiary",         24.98, 93.41, 25.14, 93.27,  3),
        ("Kamjong Rd",                 "tertiary",         25.13, 94.36, 25.32, 94.58,  3),
        ("BRO Hill Rd 1",              "unclassified",     24.50, 93.50, 24.30, 93.30,  4),
        ("BRO Hill Rd 2",              "unclassified",     25.00, 94.10, 25.20, 94.30,  3),
        ("Tengnoupal Rd",              "unclassified",     24.24, 94.27, 24.10, 94.45,  3),
    ],
    "Meghalaya": [
        ("NH-6 Shillong-Guwahati",     "national_highway", 25.57, 91.88, 26.18, 91.75,  8),
        ("NH-44 Shillong-Cherrapunji", "national_highway", 25.57, 91.88, 25.27, 91.73,  6),
        ("NH-40 Shillong-Dawki",       "national_highway", 25.57, 91.88, 25.20, 92.03,  6),
        ("NH-106 Tura-Williamnagar",   "national_highway", 25.52, 90.21, 25.70, 90.62,  6),
        ("Garo Hills Rd NH-51",        "national_highway", 25.52, 90.21, 25.90, 89.87,  6),
        ("Shillong-Nongstoin Rd",      "primary",          25.57, 91.88, 25.52, 91.27,  5),
        ("Jowai-Dawki Rd",             "primary",          25.44, 92.20, 25.20, 92.03,  4),
        ("Cherrapunji-Nongriat",       "primary",          25.27, 91.73, 25.23, 91.70,  3),
        ("Baghmara-Siju Rd",           "secondary",        25.20, 90.64, 25.04, 90.66,  4),
        ("Mawsynram Access",           "secondary",        25.30, 91.58, 25.29, 91.59,  3),
        ("Nongpoh-Umiam Rd",           "secondary",        25.90, 91.87, 25.69, 91.90,  4),
        ("Mairang-Nongstoin",          "tertiary",         25.55, 91.46, 25.52, 91.27,  3),
        ("Resubelpara Rd",             "tertiary",         25.85, 90.65, 25.70, 90.62,  3),
    ],
    "Mizoram": [
        ("NH-54 Aizawl-Imphal",        "national_highway", 23.73, 92.72, 24.68, 93.12, 10),
        ("NH-54 Aizawl-Kolasib",       "national_highway", 23.73, 92.72, 24.22, 92.67,  7),
        ("NH-54A Aizawl-Champhai",     "national_highway", 23.73, 92.72, 23.45, 93.33,  7),
        ("NH-302 Aizawl-Lunglei",      "national_highway", 23.73, 92.72, 22.88, 92.73,  7),
        ("NH-302 Lunglei-Lawngtlai",   "national_highway", 22.88, 92.73, 22.53, 92.90,  6),
        ("Kolasib-Hnahthial Rd",       "primary",          24.22, 92.67, 23.57, 92.72,  5),
        ("Champhai-Zokhawthar",        "primary",          23.45, 93.33, 23.47, 93.37,  3),
        ("Serchhip-Thenzawl",          "secondary",        23.30, 92.85, 23.02, 92.76,  4),
        ("Mamit-Zawlnuam Rd",          "secondary",        23.92, 92.47, 23.62, 92.43,  4),
        ("Lawngtlai-Sangau",           "tertiary",         22.53, 92.90, 22.25, 92.97,  3),
        ("Phullen-Haulawng",           "tertiary",         22.88, 92.73, 22.60, 92.62,  3),
        ("BRO Hmar Hills",             "unclassified",     23.57, 92.72, 23.40, 92.60,  3),
    ],
    "Nagaland": [
        ("NH-2 Kohima-Dimapur",        "national_highway", 25.67, 94.12, 25.90, 93.73,  7),
        ("NH-29A Kohima-Imphal",       "national_highway", 25.67, 94.12, 25.15, 94.05,  7),
        ("NH-702 Kohima-Zunheboto",    "national_highway", 25.67, 94.12, 26.02, 94.52,  6),
        ("NH-702B Mokokchung Rd",      "national_highway", 26.33, 94.52, 26.63, 94.51,  5),
        ("Dimapur-Medziphema",         "primary",          25.90, 93.73, 25.77, 93.90,  4),
        ("Wokha-Mokokchung Rd",        "primary",          26.10, 94.08, 26.33, 94.52,  5),
        ("Phek-Pfutsero Rd",           "primary",          25.65, 94.47, 25.49, 94.53,  4),
        ("Tuensang-Mon Rd",            "secondary",        26.64, 94.81, 26.71, 94.79,  4),
        ("Kiphire-Longkhim Rd",        "secondary",        25.91, 94.88, 26.10, 94.77,  4),
        ("Longleng-Langpangkong",      "secondary",        26.51, 94.74, 26.72, 95.02,  4),
        ("Pungro-Kiphire",             "tertiary",         26.18, 94.98, 25.91, 94.88,  3),
        ("BRO Patkai Hills",           "unclassified",     26.50, 95.00, 26.80, 95.40,  3),
    ],
    "Tripura": [
        ("NH-8 Agartala-Dharmanagar",  "national_highway", 23.84, 91.28, 24.38, 92.17, 10),
        ("NH-44 Agartala-Sabroom",     "national_highway", 23.84, 91.28, 23.00, 91.60,  8),
        ("NH-44A Agartala-Kamalpur",   "national_highway", 23.84, 91.28, 24.18, 91.82,  6),
        ("NH-208 Udaipur-Amarpur",     "national_highway", 23.54, 91.48, 23.52, 91.62,  4),
        ("Agartala-Melaghar Rd",       "primary",          23.84, 91.28, 23.76, 91.45,  4),
        ("Dharmanagar-Kumarghat Rd",   "primary",          24.38, 92.17, 24.18, 91.82,  4),
        ("Kailasahar-Manu Rd",         "primary",          24.00, 92.00, 23.87, 92.10,  3),
        ("Belonia-Sabroom Rd",         "secondary",        23.25, 91.47, 23.00, 91.60,  3),
        ("Gomati Valley Rd",           "secondary",        23.54, 91.48, 23.38, 91.60,  3),
        ("Twisung-Khowai Rd",          "secondary",        24.06, 91.60, 24.06, 91.60,  3),
        ("Jirania-Bishalgarh",         "tertiary",         23.82, 91.36, 23.68, 91.36,  3),
        ("BRO Access Rd South",        "unclassified",     23.10, 91.62, 23.00, 91.70,  3),
    ],
    "Sikkim": [
        ("NH-10 Siliguri-Gangtok",     "national_highway", 26.71, 88.43, 27.33, 88.62, 10),
        ("NH-717A Gangtok-Nathula",    "national_highway", 27.33, 88.62, 27.38, 88.84,  6),
        ("NH-31A Gangtok-Singtam",     "national_highway", 27.33, 88.62, 27.24, 88.52,  5),
        ("Gangtok-Pelling Rd",         "primary",          27.33, 88.62, 27.31, 88.18,  6),
        ("Gangtok-Lachung Rd",         "primary",          27.33, 88.62, 27.69, 88.75,  6),
        ("Ravangla-Namchi Rd",         "primary",          27.30, 88.36, 27.16, 88.36,  4),
        ("Jorethang-Melli Rd",         "secondary",        27.10, 88.15, 27.06, 88.24,  3),
        ("Yuksom-Dzongri Rd",          "secondary",        27.42, 88.17, 27.52, 88.11,  3),
        ("Rongli-Rhenock Rd",          "secondary",        27.23, 88.82, 27.18, 88.74,  3),
        ("Chungthang-Lachen",          "tertiary",         27.60, 88.64, 27.72, 88.55,  3),
        ("BRO Zuluk Rd",               "unclassified",     27.28, 88.87, 27.35, 88.99,  3),
        ("BRO North Sikkim",           "unclassified",     27.69, 88.75, 27.90, 88.80,  3),
    ],
}

# ── Per-state terrain profiles ──────────────────────────────────────────────────
# (slope_low, slope_high, river_low, river_high, ls_base_slope_div)
STATE_TERRAIN = {
    "Arunachal Pradesh": (20, 45, 1.0, 12, 7),   # Very steep, remote
    "Assam":             (3,  25, 0.5, 8,  10),   # Valley + hills mix
    "Manipur":           (10, 42, 0.5, 15, 8),    # Hill state
    "Meghalaya":         (15, 45, 0.5, 10, 7),    # Plateau edges, very steep
    "Mizoram":           (18, 45, 1.0, 12, 7),    # Very hilly
    "Nagaland":          (15, 42, 1.0, 12, 8),    # Hill state
    "Tripura":           (5,  30, 0.5, 8,  10),   # Mostly plains with hills
    "Sikkim":            (22, 45, 0.8, 10, 6),    # Extremely steep Himalayan
}

# ── Build segments ─────────────────────────────────────────────────────────────
def build_segments():
    records = []
    seg_idx = 0
    for state, corridors in STATE_CORRIDORS.items():
        sl, sh, rl, rh, ls_div = STATE_TERRAIN[state]
        for (name, hw_type, s_lat, s_lon, e_lat, e_lon, n_seg) in corridors:
            for k in range(n_seg):
                t = (k + 0.5) / n_seg
                lat = float(np.clip(s_lat + t*(e_lat-s_lat) + rng.normal(0, 0.004), -90, 90))
                lon = float(np.clip(s_lon + t*(e_lon-s_lon) + rng.normal(0, 0.004), -180, 180))
                slope    = float(rng.uniform(sl, sh))
                river_km = float(rng.uniform(rl, rh))
                ls_base  = int(slope / ls_div)
                ls_count = int(np.clip(ls_base + rng.integers(-1, 3), 0, 10))
                records.append({
                    "road_segment_id":      f"SEG{seg_idx:04d}",
                    "state":                state,
                    "road_name":            name,
                    "highway_type":         hw_type,
                    "centroid_lat":         round(lat, 6),
                    "centroid_lon":         round(lon, 6),
                    "slope_degrees":        round(slope, 2),
                    "distance_to_river_km": round(river_km, 3),
                    "past_landslide_count": ls_count,
                })
                seg_idx += 1
    return pd.DataFrame(records)


def daily_rainfall(state: str, month: int) -> float:
    scale = STATE_RAINFALL[state].get(month, 5.0)
    return float(rng.exponential(scale))


def month_to_season(month: int) -> str:
    if month in (6, 7, 8, 9):
        return "monsoon"
    elif month in (12, 1, 2):
        return "winter"
    else:
        return "summer"


# ── Generate dataset ───────────────────────────────────────────────────────────
print("Building segments for all 8 NE states...")
segments = build_segments()
print(f"  Total segments: {len(segments)} across {segments['state'].nunique()} states")
print(f"  State breakdown: {segments['state'].value_counts().to_dict()}")

dates     = pd.date_range(START_DATE, END_DATE, freq="D")
date_list = list(dates)

rows = []

for state in STATE_CORRIDORS.keys():
    state_segs = segments[segments["state"] == state]
    state_enc  = STATE_ENC[state]

    # Per-state daily rainfall (shared across segments on same day)
    date_rain = {d: daily_rainfall(state, d.month) for d in dates}

    # Rolling 3-day sum
    rolling3 = {}
    for i, d in enumerate(date_list):
        prev2 = date_rain.get(date_list[i-2], 0) if i >= 2 else 0
        prev1 = date_rain.get(date_list[i-1], 0) if i >= 1 else 0
        rolling3[d] = prev2 + prev1 + date_rain[d]

    for _, seg in state_segs.iterrows():
        slope    = seg["slope_degrees"]
        river_km = seg["distance_to_river_km"]
        ls_count = seg["past_landslide_count"]

        for date in dates:
            month   = date.month
            season  = month_to_season(month)
            rain    = round(date_rain[date], 2)
            rain3   = round(rolling3[date], 2)

            logit = (
                -4.5
                + 0.07  * rain
                + 0.04  * rain3
                + 0.08  * slope
                - 0.12  * river_km
                + 0.20  * ls_count
                + (1.5  if season == "monsoon" else
                   0.3  if season == "summer"  else
                   -0.5)
                + rng.normal(0, 0.4)
            )
            prob    = 1 / (1 + np.exp(-logit))
            blocked = int(rng.random() < prob)

            rows.append({
                "date":                  date.strftime("%Y-%m-%d"),
                "road_segment_id":       seg["road_segment_id"],
                "state":                 state,
                "state_enc":             state_enc,
                "rainfall_mm":           rain,
                "rainfall_last_3_days":  rain3,
                "slope_degrees":         slope,
                "distance_to_river_km":  river_km,
                "past_landslide_count":  ls_count,
                "season":                season,
                "road_blocked":          blocked,
            })

df = pd.DataFrame(rows)
print(f"\nGenerated {len(df):,} rows")
print(f"  Blocked rate    : {df['road_blocked'].mean():.3f} ({df['road_blocked'].mean()*100:.1f}%)")
print(f"  States          : {df['state'].nunique()}")
print(f"  Segments        : {df['road_segment_id'].nunique()}")
print(f"  Date range      : {df['date'].min()} to {df['date'].max()}")
print(f"\n  Blocked rate by state:")
for state, grp in df.groupby("state"):
    print(f"    {state:25s}: {grp['road_blocked'].mean():.3f}")

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(OUTPUT_PATH, index=False)
print(f"\nSaved -> {OUTPUT_PATH}")

# Save state encoder
with open(ENC_PATH, "w") as f:
    json.dump(STATE_ENC, f, indent=2)
print(f"Saved -> {ENC_PATH}")
