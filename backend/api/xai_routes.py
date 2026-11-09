"""
TerraPulse AI — Explainability Routes
"""

import numpy as np
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user
from database import User
from services.explainability_service import (
    compute_global_explanation,
    compute_partial_dependence,
    compute_local_explanation,
)
from services.ml_service import load_artifact
from services.duckdb_service import query_training_data

router = APIRouter(prefix="/api/xai", tags=["explainability"])


class GlobalExplainRequest(BaseModel):
    artifact_path: str
    region: Optional[Dict[str, float]] = None
    date_start: Optional[str] = None
    date_end: Optional[str] = None
    sample_size: int = 2000


class PDPRequest(BaseModel):
    artifact_path: str
    feature: str
    region: Optional[Dict[str, float]] = None
    date_start: Optional[str] = None
    date_end: Optional[str] = None


class LocalExplainRequest(BaseModel):
    artifact_path: str
    feature_values: Dict[str, float]
    observed_value: Optional[float] = None


@router.post("/global")
async def global_explanation(
    body: GlobalExplainRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Compute global model explanation.
    If region is provided, loads a bounded sample for SHAP.
    """
    try:
        artifact = load_artifact(body.artifact_path)
        features = artifact.get("features", [])

        X_sample = None
        if body.region:
            df = query_training_data(
                features=features,
                target=artifact.get("target", "NDVI"),
                min_lat=body.region.get("min_lat", -90),
                max_lat=body.region.get("max_lat", 90),
                min_lon=body.region.get("min_lon", -180),
                max_lon=body.region.get("max_lon", 180),
                date_start=body.date_start or "2000-01-01",
                date_end=body.date_end or "2026-12-31",
                max_rows=body.sample_size,
            )
            if not df.empty:
                X_sample = df[features].values

        result = compute_global_explanation(body.artifact_path, X_sample, features)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Model artifact not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pdp")
async def partial_dependence(
    body: PDPRequest,
    current_user: User = Depends(get_current_user),
):
    """Compute partial dependence plot for a single feature."""
    try:
        artifact = load_artifact(body.artifact_path)
        features = artifact.get("features", [])

        region = body.region or {"min_lat": -90, "max_lat": 90, "min_lon": -180, "max_lon": 180}
        df = query_training_data(
            features=features,
            target=artifact.get("target", "NDVI"),
            min_lat=region.get("min_lat", -90),
            max_lat=region.get("max_lat", 90),
            min_lon=region.get("min_lon", -180),
            max_lon=region.get("max_lon", 180),
            date_start=body.date_start or "2000-01-01",
            date_end=body.date_end or "2026-12-31",
            max_rows=2000,
        )

        X_sample = df[features].values if not df.empty else None
        return compute_partial_dependence(body.artifact_path, body.feature, X_sample)

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Model artifact not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/local")
async def local_explanation(
    body: LocalExplainRequest,
    current_user: User = Depends(get_current_user),
):
    """Explain a single prediction."""
    try:
        return compute_local_explanation(
            body.artifact_path,
            body.feature_values,
            body.observed_value,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Model artifact not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
