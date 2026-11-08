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
    - Native feature importance (if available)
    - SHAP values on a bounded sample (tree models)
    - Permutation importance already computed at training time
    """
    artifact = load_artifact(artifact_path)
    model = artifact["model"]
    features = artifact.get("features", feature_names or [])
    model_type = artifact.get("model_type", "unknown")
    metrics = artifact.get("metrics", {})

    result = {
        "model_type": model_type,
        "features": features,
        "metrics": metrics,
        "permutation_importance": artifact.get("permutation_importance"),
        "native_importance": artifact.get("native_importance"),
        "shap_available": False,
        "shap_mean_abs": None,
        "warnings": [],
    }

    # SHAP — only for tree models with a sample
    if X_sample is not None and model_type in ("random_forest", "hist_gradient_boosting"):
        try:
            try:
                import shap
                shap_available = True
            except Exception:
                shap_available = False
            if not shap_available:
                result["warnings"].append("shap library not available; SHAP explanations disabled.")
            else:
                explainer = shap.TreeExplainer(model)
                sample = X_sample[:MAX_SHAP_SAMPLES]
                shap_values = explainer.shap_values(sample)
                mean_abs = np.abs(shap_values).mean(axis=0)
                result["shap_available"] = True
                result["shap_mean_abs"] = {
                    features[i]: round(float(mean_abs[i]), 6)
                    for i in range(len(features))
                }
                result["shap_base_value"] = round(float(explainer.expected_value), 6)
        except Exception as e:
            result["warnings"].append(f"SHAP computation failed: {str(e)}")

    elif model_type in ("ridge",) and X_sample is not None:
        result["warnings"].append(
            "SHAP TreeExplainer is not applicable to linear models. "
            "Use permutation importance instead."
        )
    elif X_sample is None:
        result["warnings"].append(
            "No sample data provided. SHAP values require a representative sample."
        )

    return result


def compute_partial_dependence(
    artifact_path: str,
    feature: str,
    X_sample: np.ndarray,
    n_grid_points: int = 50,
) -> Dict[str, Any]:
    """
    Compute 1D partial dependence for a single feature.
    Uses a bounded sample — never the full dataset.
    """
    artifact = load_artifact(artifact_path)
    model = artifact["model"]
    features = artifact["features"]

    if feature not in features:
        raise ValueError(f"Feature '{feature}' not in model features: {features}")

    feat_idx = features.index(feature)
    sample = X_sample[:2_000]  # Bounded

    feat_min = float(sample[:, feat_idx].min())
    feat_max = float(sample[:, feat_idx].max())
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

    X = np.array([[feature_values.get(f, 0.0) for f in features]])
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
