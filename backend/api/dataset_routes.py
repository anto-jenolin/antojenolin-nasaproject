"""
TerraPulse AI — Dataset Routes
Provides file catalog, schema inspection, previews, and quality reports.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from auth import get_current_user
from database import User
from services.duckdb_service import (
    discover_files, inspect_schema, query_preview,
    query_quality_summary, ALL_VARIABLES, VARIABLE_DESCRIPTIONS,
    MAX_PREVIEW_ROWS,
)

router = APIRouter(prefix="/api/dataset", tags=["dataset"])


@router.get("/catalog")
async def get_catalog(current_user: User = Depends(get_current_user)):
    """List all discovered Parquet files with dates and sizes."""
    files = discover_files()
    total_size = sum(f["size_mb"] for f in files)
    return {
        "total_files": len(files),
        "total_size_gb": round(total_size / 1024, 2),
        "files": files,
    }


@router.get("/schema")
async def get_schema(current_user: User = Depends(get_current_user)):
    """Inspect schema from a sample Parquet file."""
    return inspect_schema()


@router.get("/variables")
async def get_variables(current_user: User = Depends(get_current_user)):
    """List available variables with descriptions."""
    return [
        {"name": name, "description": desc}
        for name, desc in VARIABLE_DESCRIPTIONS.items()
    ]


@router.get("/preview")
async def get_preview(
    min_lat: Optional[float] = Query(None, ge=-90, le=90),
    max_lat: Optional[float] = Query(None, ge=-90, le=90),
    min_lon: Optional[float] = Query(None, ge=-180, le=180),
    max_lon: Optional[float] = Query(None, ge=-180, le=180),
    date_start: Optional[str] = Query(None),
    date_end: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=MAX_PREVIEW_ROWS),
    current_user: User = Depends(get_current_user),
):
    """Return a bounded row preview for the selected region."""
    try:
        rows = query_preview(
            min_lat=min_lat, max_lat=max_lat,
            min_lon=min_lon, max_lon=max_lon,
            date_start=date_start, date_end=date_end,
            limit=limit,
        )
        return {
            "rows": rows,
            "count": len(rows),
            "limit": limit,
            "note": "Results are a bounded sample. Scale factors already applied.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quality")
async def get_quality_summary(
    min_lat: Optional[float] = Query(None, ge=-90, le=90),
    max_lat: Optional[float] = Query(None, ge=-90, le=90),
    min_lon: Optional[float] = Query(None, ge=-180, le=180),
    max_lon: Optional[float] = Query(None, ge=-180, le=180),
    date_start: Optional[str] = Query(None),
    date_end: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Compute quality statistics for the selected region."""
    try:
        return query_quality_summary(
            min_lat=min_lat, max_lat=max_lat,
            min_lon=min_lon, max_lon=max_lon,
            date_start=date_start, date_end=date_end,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_global_stats(current_user: User = Depends(get_current_user)):
    """Return high-level dataset statistics from file metadata only."""
    files = discover_files()
    dates = sorted([f["date"] for f in files if f["date"] != "unknown"])
    total_size = sum(f["size_mb"] for f in files)

    return {
        "total_files": len(files),
        "total_size_gb": round(total_size / 1024, 2),
        "temporal_coverage": {
            "start": dates[0] if dates else None,
            "end": dates[-1] if dates else None,
            "months": len(dates),
        },
        "variables": list(VARIABLE_DESCRIPTIONS.keys()),
        "product": "NASA MODIS MOD13C2 Collection 6.1",
        "spatial_resolution": "0.05 degrees (~5.5km at equator)",
        "grid": "7200 x 3600 pixels per monthly composite",
        "note": "Scale factors already applied. Fill values replaced with NaN.",
    }
