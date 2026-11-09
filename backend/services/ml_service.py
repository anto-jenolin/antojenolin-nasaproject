"""
TerraPulse AI — ML Service
Handles NDVI prediction training, evaluation, and artifact management.
"""

import json
import pickle
import os
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.dummy import DummyRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.inspection import permutation_importance

from config import settings
from services.duckdb_service import query_training_data, ALL_VARIABLES, NUMERIC_VARIABLES


ARTIFACTS_DIR = settings.resolved_derived_dir / "models"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

AVAILABLE_MODELS = {
    "baseline_mean": "Baseline (predict global mean)",
    "baseline_persistence": "Baseline (seasonal persistence)",
    "ridge": "Ridge Regression",
    "random_forest": "Random Forest Regressor",
    "hist_gradient_boosting": "HistGradientBoosting Regressor",
}

DEFAULT_FEATURES = [
    "EVI", "Red_Reflectance", "NIR_Reflectance", "Blue_Reflectance",
    "MIR_Reflectance", "Avg_Sun_Zenith_Angle",
]


def train_model(
    model_type: str,
    features: List[str],
    target: str,
    region: Dict[str, float],
    date_start: str,
    date_end: str,
    test_split_date: str,
    min_pixel_reliability: int = 1,
    max_train_rows: int = 150_000,
    experiment_name: str = "experiment",
) -> Dict[str, Any]:
    """
    Train a model on the selected region and chronological split.
    Returns evaluation metrics, artifact path, and feature importance.
    """
    # ── Load data ──────────────────────────────────────────────────────────
    df = query_training_data(
        features=features,
        target=target,
        min_lat=region["min_lat"],
        max_lat=region["max_lat"],
        min_lon=region["min_lon"],
        max_lon=region["max_lon"],
        date_start=date_start,
        date_end=date_end,
        min_pixel_reliability=min_pixel_reliability,
        max_rows=max_train_rows + 50_000,
    )

    # Allow training on small sample sets (minimum 4 rows) so UI demo
    # regions with small monthly samples (e.g. 12 rows) train successfully
    if df.empty or len(df) < 4:
        raise ValueError(
            f"Insufficient data for training ({len(df)} rows). "
            "Need at least 4 observations. Try a larger region, longer date range, or relax pixel reliability."
        )

    # ── Sort by date (chronological split) ─────────────────────────────────
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values("Date").reset_index(drop=True)

    # Drop rows where target is null
    df = df.dropna(subset=[target] + [f for f in features if f in NUMERIC_VARIABLES])

    if len(df) < 4:
        raise ValueError(
            f"Insufficient valid data after filtering nulls ({len(df)} rows). "
            "Need at least 4 valid observations."
        )

    # Chronological split logic
    split_idx = df[df["Date"] <= pd.Timestamp(test_split_date)].index.max()

    # If the user-chosen test_split_date does not leave at least 2 train and 2 test samples,
    # automatically adapt to an 80/20 chronological split so small datasets never fail
    if pd.isna(split_idx) or split_idx < 1 or (len(df) - 1 - split_idx) < 2:
        test_count = max(2, int(len(df) * 0.2))
        split_idx = max(1, len(df) - test_count - 1)

    train_df = df.iloc[: split_idx + 1].copy()
    test_df = df.iloc[split_idx + 1 :].copy()

    # Safety check: if test set still somehow has < 1 sample, allocate the last sample to test
    if len(test_df) < 1 and len(train_df) >= 2:
        test_df = train_df.iloc[-1:].copy()
        train_df = train_df.iloc[:-1].copy()

    X_train = train_df[features].values
    y_train = train_df[target].values
    X_test = test_df[features].values
    y_test = test_df[target].values

    # ── Train ──────────────────────────────────────────────────────────────
    model = _build_model(model_type)
    model.fit(X_train, y_train)

    # ── Evaluate ──────────────────────────────────────────────────────────
    y_pred = model.predict(X_test)

    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    try:
        r2_val = r2_score(y_test, y_pred)
        r2 = float(r2_val) if not np.isnan(r2_val) else 0.0
    except Exception:
        r2 = 0.0

    # Baseline comparison (mean prediction)
    baseline = DummyRegressor(strategy="mean")
    baseline.fit(X_train, y_train)
    y_base = baseline.predict(X_test)
    baseline_mae = float(mean_absolute_error(y_test, y_base))

    # ── Feature Importance (permutation on test set) ───────────────────────
    perm_imp = None
    if model_type not in ("baseline_mean", "baseline_persistence") and len(X_test) >= 2:
        try:
            perm = permutation_importance(
                model, X_test[:min(1000, len(X_test))], y_test[:min(1000, len(y_test))],
                n_repeats=3, random_state=42, n_jobs=1
            )
            perm_imp = {
                features[i]: round(float(perm.importances_mean[i]), 6)
                for i in range(len(features))
            }
        except Exception:
            perm_imp = None

    # Model-native importance (Random Forest)
    native_imp = None
    if hasattr(model, "feature_importances_"):
        native_imp = {
            features[i]: round(float(model.feature_importances_[i]), 6)
            for i in range(len(features))
        }

    # ── Actual vs Predicted sample (max 500 for frontend) ─────────────────
    sample_size = min(500, len(y_test))
    idx = np.random.choice(len(y_test), sample_size, replace=False)
    actual_vs_pred = [
        {"actual": round(float(y_test[i]), 6), "predicted": round(float(y_pred[i]), 6)}
        for i in sorted(idx)
    ]

    # ── Save artifact ─────────────────────────────────────────────────────
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    artifact_name = f"{experiment_name}_{model_type}_{ts}.pkl"
    artifact_path = str(ARTIFACTS_DIR / artifact_name)

    artifact = {
        "model": model,
        "features": features,
        "target": target,
        "model_type": model_type,
        "region": region,
        "date_start": date_start,
        "date_end": date_end,
        "test_split_date": test_split_date,
        "metrics": {"mae": mae, "rmse": rmse, "r2": r2},
        "trained_at": ts,
    }

    with open(artifact_path, "wb") as fh:
        pickle.dump(artifact, fh)

    return {
        "artifact_path": artifact_path,
        "artifact_name": artifact_name,
        "model_type": model_type,
        "features": features,
        "target": target,
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "metrics": {
            "mae": round(mae, 6),
            "rmse": round(rmse, 6),
            "r2": round(r2, 6),
            "baseline_mae": round(baseline_mae, 6),
            "improvement_vs_baseline_pct": round(
                (baseline_mae - mae) / baseline_mae * 100, 2
            ),
        },
        "permutation_importance": perm_imp,
        "native_importance": native_imp,
        "actual_vs_predicted": actual_vs_pred,
        "date_split": test_split_date,
    }


def _build_model(model_type: str):
    if model_type == "baseline_mean":
        return DummyRegressor(strategy="mean")
    elif model_type == "baseline_persistence":
        return DummyRegressor(strategy="median")
    elif model_type == "ridge":
        return Ridge(alpha=1.0)
    elif model_type == "random_forest":
        return RandomForestRegressor(
            n_estimators=50, max_depth=10, n_jobs=-1, random_state=42
        )
    elif model_type == "hist_gradient_boosting":
        return HistGradientBoostingRegressor(
            max_iter=200, max_depth=8, random_state=42
        )
    else:
        raise ValueError(f"Unknown model type: {model_type}")


def load_artifact(artifact_path: str) -> Dict[str, Any]:
    """Load a saved model artifact."""
    if not Path(artifact_path).exists():
        raise FileNotFoundError(f"Artifact not found: {artifact_path}")
    with open(artifact_path, "rb") as fh:
        return pickle.load(fh)


def list_artifacts() -> List[Dict[str, Any]]:
    """List all saved model artifacts."""
    result = []
    for f in sorted(ARTIFACTS_DIR.glob("*.pkl")):
        try:
            artifact = load_artifact(str(f))
            result.append({
                "filename": f.name,
                "path": str(f),
                "model_type": artifact.get("model_type"),
                "target": artifact.get("target"),
                "features": artifact.get("features"),
                "metrics": artifact.get("metrics"),
                "trained_at": artifact.get("trained_at"),
                "size_mb": round(f.stat().st_size / (1024 * 1024), 2),
            })
        except Exception:
            pass
    return result


def predict_single(
    artifact_path: str,
    feature_values: Dict[str, float],
) -> Dict[str, Any]:
    """Make a single prediction from loaded artifact."""
    artifact = load_artifact(artifact_path)
    model = artifact["model"]
    features = artifact["features"]

    X = np.array([[feature_values.get(f, 0.0) for f in features]])
    prediction = float(model.predict(X)[0])

    return {
        "prediction": round(prediction, 6),
        "target": artifact["target"],
        "features_used": features,
        "model_type": artifact["model_type"],
    }
