"""
train_model.py — Train XGBoost classifier for road accessibility risk prediction.
Covers all 8 Northeast Indian states with state_enc as a feature.
"""
import json
import warnings
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")

# -- Paths ----------------------------------------------------------------------
ROOT       = Path(__file__).resolve().parents[1]
DATA_PATH  = ROOT / "data"   / "data.csv"
MODEL_DIR  = ROOT / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# ═══════════════════════════════════════════════════════════════════════════════
# 1. Load & clean
# ═══════════════════════════════════════════════════════════════════════════════
print("=" * 60)
print("STEP 1 — Loading and cleaning data")
print("=" * 60)

df = pd.read_csv(DATA_PATH, parse_dates=["date"])
print(f"  Rows loaded        : {len(df):,}")
print(f"  Columns            : {list(df.columns)}")
print(f"  States             : {sorted(df['state'].unique())}")
print(f"  Segments           : {df['road_segment_id'].nunique()}")

# Fix dtypes
df["road_blocked"] = df["road_blocked"].astype(int)

# Remove duplicates
before = len(df)
df.drop_duplicates(inplace=True)
print(f"  Duplicates removed : {before - len(df)}")

# Handle nulls
null_counts = df.isnull().sum()
if null_counts.sum() > 0:
    print(f"  Nulls found:\n{null_counts[null_counts > 0]}")
    df.dropna(inplace=True)
else:
    print("  No nulls detected.")

print(f"  Final dataset size : {len(df):,}")
print(f"  Target balance     : {df['road_blocked'].value_counts().to_dict()}")

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Feature engineering
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 2 — Feature engineering")
print("=" * 60)

# Encode 'season' (ordinal: winter < summer < monsoon in risk terms)
season_order = {"winter": 0, "summer": 1, "monsoon": 2}
df["season_enc"] = df["season"].map(season_order)

# Encode 'road_segment_id' with label encoding
le = LabelEncoder()
df["segment_enc"] = le.fit_transform(df["road_segment_id"])

# state_enc is already in the CSV; ensure it's integer
if "state_enc" not in df.columns:
    # Derive from state column if missing
    STATE_ENC = {s: i for i, s in enumerate(sorted(df["state"].unique()))}
    df["state_enc"] = df["state"].map(STATE_ENC)
else:
    df["state_enc"] = df["state_enc"].astype(int)

# Save state encoder for use in predict.py
state_enc_map = {state: int(code) for state, code in
                 df[["state", "state_enc"]].drop_duplicates().set_index("state")["state_enc"].items()}
state_enc_path = MODEL_DIR / "state_encoder.json"
with open(state_enc_path, "w") as f:
    json.dump(state_enc_map, f, indent=2)
print(f"  State encoder saved -> {state_enc_path}")
print(f"  State encoding: {state_enc_map}")

# Extract temporal features from date
df["month"]       = df["date"].dt.month
df["day_of_week"] = df["date"].dt.dayofweek

# Interaction feature: rainfall × slope risk
df["rain_slope_interaction"]  = df["rainfall_mm"]            * df["slope_degrees"] / 100.0
df["rain3_slope_interaction"] = df["rainfall_last_3_days"]   * df["slope_degrees"] / 100.0

FEATURE_COLS = [
    "rainfall_mm",
    "rainfall_last_3_days",
    "slope_degrees",
    "distance_to_river_km",
    "past_landslide_count",
    "season_enc",
    "state_enc",            # NEW: state-level risk differentiation
    "segment_enc",
    "month",
    "day_of_week",
    "rain_slope_interaction",
    "rain3_slope_interaction",
]

TARGET_COL = "road_blocked"

print(f"  Feature columns ({len(FEATURE_COLS)}): {FEATURE_COLS}")

X = df[FEATURE_COLS]
y = df[TARGET_COL]

# ═══════════════════════════════════════════════════════════════════════════════
# 3. Train / test split (stratified)
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 3 — Train/test split (80/20, stratified)")
print("=" * 60)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
print(f"  Train size : {len(X_train):,}")
print(f"  Test  size : {len(X_test):,}")

# ═══════════════════════════════════════════════════════════════════════════════
# 4. Baseline model
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 4 — Baseline XGBClassifier")
print("=" * 60)

blocked_rate = y_train.mean()
scale_pos_weight = round((1 - blocked_rate) / blocked_rate, 2) if blocked_rate > 0 else 1.0
print(f"  Blocked rate (train): {blocked_rate:.3f}")
print(f"  scale_pos_weight    : {scale_pos_weight}")

baseline = XGBClassifier(
    n_estimators=100,
    max_depth=4,
    learning_rate=0.1,
    scale_pos_weight=scale_pos_weight,
    eval_metric="logloss",
    random_state=42,
    n_jobs=-1,
)
baseline.fit(X_train, y_train)
y_pred_base = baseline.predict(X_test)

print("\nBaseline Classification Report:")
print(classification_report(y_test, y_pred_base, target_names=["Not Blocked", "Blocked"]))
print("Baseline Confusion Matrix:")
print(confusion_matrix(y_test, y_pred_base))

# ═══════════════════════════════════════════════════════════════════════════════
# 5. Hyperparameter tuning (GridSearchCV)
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 5 — GridSearchCV hyperparameter tuning")
print("=" * 60)

param_grid = {
    "max_depth":     [3, 4, 6],
    "n_estimators":  [100, 200, 300],
    "learning_rate": [0.05, 0.1, 0.2],
}

xgb_tuned = XGBClassifier(
    scale_pos_weight=scale_pos_weight,
    eval_metric="logloss",
    random_state=42,
    n_jobs=-1,
)

grid_search = GridSearchCV(
    estimator=xgb_tuned,
    param_grid=param_grid,
    cv=3,
    scoring="f1",
    n_jobs=-1,
    verbose=1,
)
grid_search.fit(X_train, y_train)

print(f"\n  Best params : {grid_search.best_params_}")
print(f"  Best CV F1  : {grid_search.best_score_:.4f}")

# ═══════════════════════════════════════════════════════════════════════════════
# 6. Retrain best model on full training set
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 6 — Retrain best model on full training set")
print("=" * 60)

best_model = grid_search.best_estimator_
best_model.fit(X_train, y_train)

y_pred_final = best_model.predict(X_test)
y_prob_final = best_model.predict_proba(X_test)[:, 1]

print("\n* FINAL MODEL EVALUATION (NE India — 8 States) *")
print("-" * 50)
report = classification_report(
    y_test, y_pred_final,
    target_names=["Not Blocked", "Blocked"],
    output_dict=True
)
print(classification_report(y_test, y_pred_final, target_names=["Not Blocked", "Blocked"]))
print("Final Confusion Matrix:")
print(confusion_matrix(y_test, y_pred_final))

blocked_metrics     = report["Blocked"]
not_blocked_metrics = report["Not Blocked"]
overall_acc         = report["accuracy"]
macro_f1            = report["macro avg"]["f1-score"]

print("\n-- Key Metrics (Blocked class) --")
print(f"  Precision : {blocked_metrics['precision']:.4f}")
print(f"  Recall    : {blocked_metrics['recall']:.4f}")
print(f"  F1-score  : {blocked_metrics['f1-score']:.4f}")
print(f"\n-- Overall --")
print(f"  Accuracy  : {overall_acc:.4f}")
print(f"  Macro F1  : {macro_f1:.4f}")

# Per-state accuracy breakdown
print("\n-- Per-state accuracy --")
df_test = X_test.copy()
df_test["y_true"]   = y_test.values
df_test["y_pred"]   = y_pred_final
df_test["state_enc_col"] = df_test["state_enc"]
state_enc_rev = {v: k for k, v in state_enc_map.items()}
for enc, grp in df_test.groupby("state_enc_col"):
    acc = (grp["y_true"] == grp["y_pred"]).mean()
    print(f"    {state_enc_rev.get(enc, str(enc)):25s}: acc={acc:.3f}  n={len(grp):,}")

# ═══════════════════════════════════════════════════════════════════════════════
# 7. SHAP summary plot
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 7 — Generating SHAP summary plot")
print("=" * 60)

explainer  = shap.TreeExplainer(best_model)
sample_idx = np.random.choice(len(X_test), size=min(1000, len(X_test)), replace=False)
X_sample   = X_test.iloc[sample_idx]
shap_values = explainer.shap_values(X_sample)

fig, ax = plt.subplots(figsize=(10, 6))
shap.summary_plot(
    shap_values,
    X_sample,
    feature_names=FEATURE_COLS,
    show=False,
    plot_type="dot",
)
plt.title("SHAP Feature Importance — NE India Road Risk Model (8 States)", fontsize=14, fontweight="bold")
plt.tight_layout()
shap_path = MODEL_DIR / "feature_importance.png"
plt.savefig(shap_path, dpi=150, bbox_inches="tight")
plt.close()
print(f"  SHAP plot saved -> {shap_path}")

mean_shap = np.abs(shap_values).mean(axis=0)
shap_rank = sorted(zip(FEATURE_COLS, mean_shap), key=lambda x: x[1], reverse=True)
print("\n  Feature importance ranking (mean |SHAP|):")
for rank, (feat, val) in enumerate(shap_rank, 1):
    print(f"    {rank:2d}. {feat:<30s}  {val:.4f}")

# ═══════════════════════════════════════════════════════════════════════════════
# 8. Save model + feature columns
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 8 — Saving model artifacts")
print("=" * 60)

model_path = MODEL_DIR / "risk_model.json"
best_model.save_model(str(model_path))
print(f"  Model saved         -> {model_path}")

feat_cols_path = MODEL_DIR / "feature_columns.json"
with open(feat_cols_path, "w") as f:
    json.dump(FEATURE_COLS, f, indent=2)
print(f"  Feature cols saved  -> {feat_cols_path}")

# Verify files exist
print("\n  Verifying output files:")
for p in [model_path, feat_cols_path, shap_path, state_enc_path]:
    size = p.stat().st_size / 1024
    print(f"    [OK] {p.name}  ({size:.1f} KB)")

print("\n" + "=" * 60)
print("TRAINING COMPLETE — NE India Road Risk ML (8 States)")
print("=" * 60)
