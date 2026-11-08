"""
TerraPulse AI — Explorer Routes
Provides aggregated grids for map display, time-series for charts,
statistical Earth change analysis, and annotated CSV export.
Never returns raw pixel-level datasets to the browser.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import User, SavedRegion, get_db
from services.duckdb_service import ALL_VARIABLES as DUCKDB_ALL_VARS
from services.earth_change_service import (
    list_variables,
    analyze,
    generate_csv,
    ALL_MISSION_VARIABLES,
)
from services.data_source import LocalParquetSource, ExternalAPISource
from models.earth_change_request import EarthChangeRequest
from models.trend_request import TrendRequest


router = APIRouter(prefix="/api/explorer", tags=["explorer"])


# ── Saved Region Models ───────────────────────────────────────────────────────

class SaveRegionRequest(BaseModel):
    name: str
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float


# ── Saved Region CRUD ─────────────────────────────────────────────────────────

@router.get("/regions")
async def list_regions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all saved regions for the current user."""
    regions = (
        db.query(SavedRegion)
        .filter(SavedRegion.user_id == current_user.id)
        .order_by(SavedRegion.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "name": r.name,
            "min_lat": r.min_lat,
            "max_lat": r.max_lat,
            "min_lon": r.min_lon,
            "max_lon": r.max_lon,
            "created_at": str(r.created_at),
        }
        for r in regions
    ]


@router.post("/regions")
async def save_region(
    body: SaveRegionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a region for the current user."""
    if body.min_lat >= body.max_lat:
        raise HTTPException(status_code=400, detail="min_lat must be less than max_lat")
    if body.min_lon >= body.max_lon:
        raise HTTPException(status_code=400, detail="min_lon must be less than max_lon")
    if not (-90 <= body.min_lat <= 90 and -90 <= body.max_lat <= 90):
        raise HTTPException(status_code=400, detail="Latitudes must be in range [-90, 90]")
    if not (-180 <= body.min_lon <= 180 and -180 <= body.max_lon <= 180):
        raise HTTPException(status_code=400, detail="Longitudes must be in range [-180, 180]")

    region = SavedRegion(
        user_id=current_user.id,
        name=body.name,
        min_lat=body.min_lat,
        max_lat=body.max_lat,
        min_lon=body.min_lon,
        max_lon=body.max_lon,
    )
    db.add(region)
    db.commit()
    db.refresh(region)
    return {
        "id": region.id,
        "name": region.name,
        "min_lat": region.min_lat,
        "max_lat": region.max_lat,
        "min_lon": region.min_lon,
        "max_lon": region.max_lon,
    }


@router.delete("/regions/{region_id}")
async def delete_region(
    region_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a saved region (only the owner can delete)."""
    region = db.query(SavedRegion).filter(
        SavedRegion.id == region_id,
        SavedRegion.user_id == current_user.id,
    ).first()
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    db.delete(region)
    db.commit()
    return {"message": f"Region {region_id} deleted"}


# ── Grid Query ────────────────────────────────────────────────────────────────

@router.get("/grid")
def get_grid(
    variable: str = Query("NDVI"),
    resolution: float = Query(0.5, ge=0.1, le=5.0),
    min_lat: Optional[float] = Query(None, ge=-90, le=90),
    max_lat: Optional[float] = Query(None, ge=-90, le=90),
    min_lon: Optional[float] = Query(None, ge=-180, le=180),
    max_lon: Optional[float] = Query(None, ge=-180, le=180),
    date_start: Optional[str] = Query(None),
    date_end: Optional[str] = Query(None),
    min_pixel_reliability: Optional[int] = Query(None, ge=0, le=3),
    source: str = Query("local"),
    current_user: User = Depends(get_current_user),
):
    """
    Return spatially aggregated grid values for map rendering.
    Supports both local Parquet and external multi-mission feeds.
    """
    if variable not in ALL_MISSION_VARIABLES and variable not in DUCKDB_ALL_VARS:
        raise HTTPException(status_code=400, detail=f"Unknown variable: {variable}")

    try:
        data_source = LocalParquetSource() if source == "local" else ExternalAPISource()
        grid = data_source.grid(
            variable=variable,
            resolution=resolution,
            bounds={"min_lat": min_lat, "max_lat": max_lat, "min_lon": min_lon, "max_lon": max_lon},
            date_start=date_start,
            date_end=date_end,
            reliability=min_pixel_reliability,
        )
        return {
            "variable": variable,
            "resolution_deg": resolution,
            "cell_count": len(grid),
            "grid": grid,
            "source": source,
            "note": "Values are spatial means aggregated to the requested resolution.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Time-Series Query ─────────────────────────────────────────────────────────

@router.get("/timeseries")
def get_timeseries(
    variable: str = Query("NDVI"),
    min_lat: Optional[float] = Query(None, ge=-90, le=90),
    max_lat: Optional[float] = Query(None, ge=-90, le=90),
    min_lon: Optional[float] = Query(None, ge=-180, le=180),
    max_lon: Optional[float] = Query(None, ge=-180, le=180),
    date_start: Optional[str] = Query(None),
    date_end: Optional[str] = Query(None),
    min_pixel_reliability: Optional[int] = Query(None, ge=0, le=3),
    source: str = Query("local"),
    current_user: User = Depends(get_current_user),
):
    """
    Return monthly mean time series for the selected region, variable, and source.
    """
    if variable not in ALL_MISSION_VARIABLES and variable not in DUCKDB_ALL_VARS:
        raise HTTPException(status_code=400, detail=f"Unknown variable: {variable}")

    try:
        data_source = LocalParquetSource() if source == "local" else ExternalAPISource()
        series = data_source.time_series(
            variable=variable,
            bounds={"min_lat": min_lat, "max_lat": max_lat, "min_lon": min_lon, "max_lon": max_lon},
            date_start=date_start,
            date_end=date_end,
            reliability=min_pixel_reliability,
        )
        return {
            "variable": variable,
            "series": series,
            "count": len(series),
            "source": source,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Trend Analysis ─────────────────────────────────────────────────────────────

@router.post("/trend")
async def compute_trend_endpoint(
    request: TrendRequest,
    current_user: User = Depends(get_current_user),
):
    """Return statistical trend analysis for a variable over a region."""
    from services.trend_service import compute_trend
    try:
        result = compute_trend(
            variable=request.variable,
            min_lat=request.min_lat,
            max_lat=request.max_lat,
            min_lon=request.min_lon,
            max_lon=request.max_lon,
            date_start=request.date_start,
            date_end=request.date_end,
            min_pixel_reliability=request.min_pixel_reliability,
            mann_kendall=request.mann_kendall,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Variables Catalog ─────────────────────────────────────────────────────────

@router.get("/variables")
def get_variables(current_user: User = Depends(get_current_user)):
    """Return list of available Earth science variables across missions and models with metadata."""
    try:
        return list_variables()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Earth Change Analysis ──────────────────────────────────────────────────────

@router.post("/analysis")
def run_analysis(
    request: EarthChangeRequest,
    source: str = Query("local"),
    current_user: User = Depends(get_current_user),
):
    """
    Run comprehensive Earth Change Analysis:
    Calculates rate of change (slope/yr), 95% confidence intervals, p-value,
    R-squared, Mann-Kendall test, and natural language Data Detective report.
    """
    try:
        region = {
            "min_lat": request.min_lat,
            "max_lat": request.max_lat,
            "min_lon": request.min_lon,
            "max_lon": request.max_lon,
        }
        result = analyze(
            variable=request.variable,
            date_start=request.date_start or "2000-02-01",
            date_end=request.date_end or "2026-08-01",
            region=region,
            min_pixel_reliability=request.min_pixel_reliability or 0,
            significance_alpha=request.significance_alpha,
            use_mann_kendall=request.mann_kendall,
            source=source,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── CSV Export ────────────────────────────────────────────────────────────────

@router.get("/export")
def export_csv(
    variable: str = Query(...),
    min_lat: float = Query(...),
    max_lat: float = Query(...),
    min_lon: float = Query(...),
    max_lon: float = Query(...),
    date_start: str = Query(...),
    date_end: str = Query(...),
    min_pixel_reliability: Optional[int] = Query(0),
    significance_alpha: float = Query(0.05),
    mann_kendall: bool = Query(False),
    source: str = Query("local"),
    current_user: User = Depends(get_current_user),
):
    """
    Return annotated CSV string for analysis with a clean descriptive filename.
    Format: <variable>_<date_start>_to_<date_end>.csv
    """
    try:
        region = {
            "min_lat": min_lat,
            "max_lat": max_lat,
            "min_lon": min_lon,
            "max_lon": max_lon,
        }
        analysis_data = analyze(
            variable=variable,
            date_start=date_start,
            date_end=date_end,
            region=region,
            min_pixel_reliability=min_pixel_reliability or 0,
            significance_alpha=significance_alpha,
            use_mann_kendall=mann_kendall,
            source=source,
        )
        csv_str = generate_csv(analysis_data)
        safe_start = date_start.replace(":", "-")
        safe_end = date_end.replace(":", "-")
        filename = f"{variable}_{safe_start}_to_{safe_end}.csv"
        return {"csv": csv_str, "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
