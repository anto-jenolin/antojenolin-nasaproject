# backend/routers/earth_change_router.py
"""FastAPI router for Earth Change Explorer API endpoints.
All endpoints are protected by the existing auth dependency (if required).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List

from ..models.earth_change import (
    VariableInfo,
    AnalyzeRequest,
    AnalyzeResponse,
    ExportResponse,
    RegionSpec,
)
from ..services.earth_change_service import (
    list_variables,
    analyze,
    generate_csv,
)
from auth import get_current_user  # existing auth dependency (optional)

router = APIRouter(prefix="/earth-change", tags=["earth-change"])

# ---------------------------------------------------------------------------
# Variable discovery
# ---------------------------------------------------------------------------
@router.get("/variables", response_model=List[VariableInfo])
async def get_variables(user=Depends(get_current_user)):
    """Return discovered variables from the MODIS parquet dataset."""
    try:
        return list_variables()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

# ---------------------------------------------------------------------------
# Main analysis endpoint
# ---------------------------------------------------------------------------
@router.post("/analyze", response_model=AnalyzeResponse)
async def post_analyze(req: AnalyzeRequest, user=Depends(get_current_user)):
    """Run the full Earth‑change analysis and return results.
    The service will raise HTTPException on validation errors.
    """
    result = analyze(
        variable=req.variable,
        date_start=req.date_start.isoformat(),
        date_end=req.date_end.isoformat(),
        region=req.region.dict() if req.region else None,
        min_pixel_reliability=req.min_pixel_reliability,
        significance_alpha=req.significance_alpha,
        use_mann_kendall=req.use_mann_kendall,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    # Convert raw dict to Pydantic model for proper response formatting
    return AnalyzeResponse(**result)

# ---------------------------------------------------------------------------
# CSV export endpoint (simple streaming)
# ---------------------------------------------------------------------------
@router.get("/export/csv", response_model=ExportResponse)
async def export_csv(
    variable: str = Query(...),
    date_start: str = Query(...),
    date_end: str = Query(...),
    min_lat: float = Query(None),
    max_lat: float = Query(None),
    min_lon: float = Query(None),
    max_lon: float = Query(None),
    min_pixel_reliability: int = Query(0, ge=0, le=3),
    user=Depends(get_current_user),
):
    """Generate a CSV file for the requested analysis.
    Returns a temporary download URL (served by FastAPI's FileResponse).
    """
    region = {
        "min_lat": min_lat,
        "max_lat": max_lat,
        "min_lon": min_lon,
        "max_lon": max_lon,
    }
    # Re‑use the analysis logic (no Mann‑Kendall for export to keep it fast)
    analysis = analyze(
        variable=variable,
        date_start=date_start,
        date_end=date_end,
        region=region,
        min_pixel_reliability=min_pixel_reliability,
        significance_alpha=0.05,
        use_mann_kendall=False,
    )
    csv_content = generate_csv(analysis)
    # Write to a temporary file inside the project (ensuring cleanup later)
    import os, uuid, tempfile
    filename = f"{variable}_{date_start}_{date_end}.csv"
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{filename}")
    with open(temp_path, "w", encoding="utf-8") as f:
        f.write(csv_content)
    # Return a URL that the frontend can fetch – FastAPI will serve via static files
    download_url = f"/temp-exports/{os.path.basename(temp_path)}"
    return ExportResponse(download_url=download_url, filename=filename)

# Note: a separate static mount for /temp-exports can be added in main.py if desired.

# End of router
