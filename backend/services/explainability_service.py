"""
TerraPulse AI — Explainability Service
Computes SHAP values, permutation importance, partial dependence plots,
and local prediction explanations using bounded samples.
"""

import numpy as np
import pickle
from pathlib import Path
from typing import List, Dict, Any, Optional

from services.ml_service import load_artifact, ARTIFACTS_DIR


MAX_SHAP_SAMPLES = 2_000  # Never compute SHAP on billions of records


def compute_global_explanation(
    artifact_path: str,
    X_sample: Optional[np.ndarray] = None,
    feature_names: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Compute global explanation for a model:
    - Native feature importance (if available, dynamically computed from model)
    - SHAP values on a bounded or synthetic sample (tree models)
    - Permutation importance
    - Model provenance info
    """
    artifact = load_artifact(artifact_path)
    model = artifact["model"]
    features = artifact.get("features", feature_names or [])
    model_type = artifact.get("model_type", "unknown")
    metrics = artifact.get("metrics", {})

    # Extract native importance dynamically from model if not saved in artifact
    native_imp = artifact.get("native_importance")
    if not native_imp and features:
        if hasattr(model, "feature_importances_"):
            importances = model.feature_importances_
            total = float(np.sum(importances))
            norm = importances / total if total > 0 else importances
            native_imp = {
                features[i]: round(float(norm[i]), 6)
                for i in range(len(features))
            }
        elif hasattr(model, "coef_"):
            coefs = np.abs(model.coef_)
            total = float(np.sum(coefs))
            norm = coefs / total if total > 0 else coefs
            native_imp = {
                features[i]: round(float(norm[i]), 6)
                for i in range(len(features))
            }
        else:
            # Fallback uniform baseline if neither attribute exists
            native_imp = {f: round(1.0 / len(features), 6) for f in features}

    perm_imp = artifact.get("permutation_importance")

    # Model provenance metadata
    model_info = {
        "algorithm": model_type.replace("_", " ").title(),
        "target": artifact.get("target", "NDVI"),
        "features": ", ".join(features),
        "r2_score": f"{metrics.get('r2', 0.0):.4f}" if metrics.get("r2") is not None else "N/A",
        "mae": f"{metrics.get('mae', 0.0):.6f}" if metrics.get("mae") is not None else "N/A",
        "rmse": f"{metrics.get('rmse', 0.0):.6f}" if metrics.get("rmse") is not None else "N/A",
        "trained_at": artifact.get("trained_at", "N/A"),
    }

    result = {
        "model_type": model_type,
        "features": features,
        "metrics": metrics,
        "model_info": model_info,
        "permutation_importance": perm_imp,
        "native_importance": native_imp,
        "shap_available": False,
        "shap_mean_abs": None,
        "warnings": [],
    }

    # If no sample was provided, construct a realistic synthetic sample for SHAP
    if X_sample is None or len(X_sample) == 0:
        np.random.seed(42)
        n_syn = 100
        syn_cols = []
        for f in features:
            f_lower = f.lower()
            if "evi" in f_lower or "ndvi" in f_lower:
                syn_cols.append(np.random.uniform(0.15, 0.65, size=n_syn))
            elif "nir" in f_lower:
                syn_cols.append(np.random.uniform(0.20, 0.55, size=n_syn))
            elif "red" in f_lower or "blue" in f_lower:
                syn_cols.append(np.random.uniform(0.02, 0.20, size=n_syn))
            elif "mir" in f_lower:
                syn_cols.append(np.random.uniform(0.05, 0.30, size=n_syn))
            elif "angle" in f_lower or "zenith" in f_lower:
                syn_cols.append(np.random.uniform(20.0, 50.0, size=n_syn))
            else:
                syn_cols.append(np.random.uniform(0.1, 0.8, size=n_syn))
        X_sample = np.column_stack(syn_cols) if syn_cols else None

    # SHAP — for tree models with a sample
    if X_sample is not None and model_type in ("random_forest", "hist_gradient_boosting"):
        try:
            import shap
            explainer = shap.TreeExplainer(model)
            sample = X_sample[:min(len(X_sample), MAX_SHAP_SAMPLES)]
            shap_values = explainer.shap_values(sample)
            mean_abs = np.abs(shap_values).mean(axis=0)
            result["shap_available"] = True
            result["shap_mean_abs"] = {
                features[i]: round(float(mean_abs[i]), 6)
                for i in range(len(features))
            }
            if hasattr(explainer, "expected_value"):
                ev = explainer.expected_value
                if isinstance(ev, (list, np.ndarray)):
                    ev = ev[0]
                result["shap_base_value"] = round(float(ev), 6)
        except Exception as e:
            result["warnings"].append(f"SHAP computation note: {str(e)}")

    elif model_type in ("ridge",):
        result["warnings"].append(
            "SHAP TreeExplainer is not applicable to linear models. "
            "Use native coefficient or permutation importance instead."
        )

    return result


def compute_partial_dependence(
    artifact_path: str,
    feature: str,
    X_sample: Optional[np.ndarray] = None,
    n_grid_points: int = 50,
) -> Dict[str, Any]:
    """
    Compute 1D partial dependence for a single feature.
    Uses a bounded sample — never the full dataset.
    """
    artifact = load_artifact(artifact_path)
    model = artifact["model"]
    features = artifact["features"]

    # Match feature case-insensitively if needed
    matched_feat = None
    for f in features:
        if f.lower() == feature.lower():
            matched_feat = f
            break
    if not matched_feat:
        raise ValueError(f"Feature '{feature}' not in model features: {features}")
    feature = matched_feat

    if X_sample is None or len(X_sample) == 0:
        np.random.seed(42)
        n_syn = 100
        syn_cols = []
        for f in features:
            f_lower = f.lower()
            if "evi" in f_lower or "ndvi" in f_lower:
                syn_cols.append(np.random.uniform(0.15, 0.65, size=n_syn))
            elif "nir" in f_lower:
                syn_cols.append(np.random.uniform(0.20, 0.55, size=n_syn))
            elif "red" in f_lower or "blue" in f_lower:
                syn_cols.append(np.random.uniform(0.02, 0.20, size=n_syn))
            elif "mir" in f_lower:
                syn_cols.append(np.random.uniform(0.05, 0.30, size=n_syn))
            elif "angle" in f_lower or "zenith" in f_lower:
                syn_cols.append(np.random.uniform(20.0, 50.0, size=n_syn))
            else:
                syn_cols.append(np.random.uniform(0.1, 0.8, size=n_syn))
        sample = np.column_stack(syn_cols)
    else:
        sample = X_sample[:2_000]

    feat_idx = features.index(feature)

    feat_min = float(sample[:, feat_idx].min())
    feat_max = float(sample[:, feat_idx].max())
    if feat_min == feat_max:
        feat_min -= 0.1
        feat_max += 0.1
    grid = np.linspace(feat_min, feat_max, n_grid_points)

    pdp_values = []
    for val in grid:
        X_mod = sample.copy()
        X_mod[:, feat_idx] = val
        pdp_values.append(float(model.predict(X_mod).mean()))

    return {
        "feature": feature,
        "grid": [round(float(v), 6) for v in grid],
        "pdp": [round(float(v), 6) for v in pdp_values],
        "feat_min": round(feat_min, 6),
        "feat_max": round(feat_max, 6),
        "sample_size": len(sample),
    }


def compute_local_explanation(
    artifact_path: str,
    feature_values: Dict[str, float],
    observed_value: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Explain a single prediction using SHAP (tree models) or
    coefficient-based linear attribution (Ridge).
    """
    artifact = load_artifact(artifact_path)
    model = artifact["model"]
    features = artifact["features"]
    model_type = artifact["model_type"]

    val_map = {str(k).strip().lower(): float(v) for k, v in feature_values.items()}
    X = np.array([[val_map.get(f.lower(), float(feature_values.get(f, 0.0))) for f in features]])
    prediction = float(model.predict(X)[0])

    explanation = {
        "prediction": round(prediction, 6),
        "observed": observed_value,
        "error": round(abs(prediction - observed_value), 6) if observed_value is not None else None,
        "model_type": model_type,
        "features": features,
        "feature_values": feature_values,
        "attribution_method": None,
        "feature_contributions": None,
        "base_value": None,
        "limitations": [],
    }

    # Try SHAP for tree models
    if model_type in ("random_forest", "hist_gradient_boosting"):
        try:
            import shap
            explainer = shap.TreeExplainer(model)
            shap_vals = explainer.shap_values(X)[0]
            explanation["attribution_method"] = "SHAP TreeExplainer"
            explanation["base_value"] = round(float(explainer.expected_value), 6)
            explanation["feature_contributions"] = {
                features[i]: round(float(shap_vals[i]), 6)
                for i in range(len(features))
            }
        except Exception as e:
            explanation["limitations"].append(f"SHAP failed: {str(e)}")

    elif model_type == "ridge":
        # Linear attribution: contribution = coef * value
        coefs = model.coef_
        intercept = model.intercept_
        explanation["attribution_method"] = "Linear coefficient attribution"
        explanation["base_value"] = round(float(intercept), 6)
        explanation["feature_contributions"] = {
            features[i]: round(float(coefs[i] * feature_values.get(features[i], 0.0)), 6)
            for i in range(len(features))
        }
    else:
        explanation["limitations"].append(
            "Local explanations are not available for baseline models."
        )

    explanation["limitations"].append(
        "Feature contributions describe the model's behavior for this prediction. "
        "They do not establish the cause of vegetation change."
    )

    return explanation
