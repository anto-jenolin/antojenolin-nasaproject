"""
TerraPulse AI — Preprocessing Routes
"""

import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db, User, Job, JobStatus, JobType
from services.preprocessing_service import (
    run_preprocessing_job, preview_preprocessing,
    MISSING_STRATEGIES, NORMALIZATION_METHODS,
)
from services.job_service import create_job, update_job, get_job

router = APIRouter(prefix="/api/preprocessing", tags=["preprocessing"])


class PreprocessingConfig(BaseModel):
    # Region
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float
    date_start: str
    date_end: str
    # Column selection
    variables: List[str] = ["NDVI", "EVI"]
    # Quality
    max_pixel_reliability: int = 1   # 0=good only, 1=good+marginal
    # Missing value strategy
    missing_strategy: str = "drop"   # drop | fill_mean | fill_median | interpolate
    # Outlier removal
    remove_outliers: bool = True
    outlier_iqr_factor: float = 3.0
    # Normalisation
    normalization: str = "none"      # none | minmax | zscore
    # Feature engineering
    add_month: bool = True
    add_season: bool = True
    add_lag1: bool = False
    # Output
    job_name: str = "preprocessing_job"
    max_rows: int = 500_000


class PreviewConfig(BaseModel):
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float
    date_start: str
    date_end: str
    variables: List[str] = ["NDVI", "EVI"]
    max_pixel_reliability: int = 1
    missing_strategy: str = "drop"
    remove_outliers: bool = True
    outlier_iqr_factor: float = 3.0
    normalization: str = "none"
    limit: int = 500


@router.get("/options")
async def get_options(current_user: User = Depends(get_current_user)):
    """Return available strategies and normalization methods."""
    return {
        "missing_strategies": MISSING_STRATEGIES,
        "normalization_methods": NORMALIZATION_METHODS,
    }


@router.post("/preview")
async def preview(
    body: PreviewConfig,
    current_user: User = Depends(get_current_user),
):
    """Return a before/after preview of the preprocessing steps."""
    try:
        return preview_preprocessing(
            min_lat=body.min_lat, max_lat=body.max_lat,
            min_lon=body.min_lon, max_lon=body.max_lon,
            date_start=body.date_start, date_end=body.date_end,
            variables=body.variables,
            max_pixel_reliability=body.max_pixel_reliability,
            missing_strategy=body.missing_strategy,
            remove_outliers=body.remove_outliers,
            outlier_iqr_factor=body.outlier_iqr_factor,
            normalization=body.normalization,
            limit=body.limit,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run")
async def start_preprocessing(
    body: PreprocessingConfig,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start a preprocessing job in the background."""
    job = create_job(
        db=db,
        user_id=current_user.id,
        job_type=JobType.PREPROCESSING,
        name=body.job_name,
        config=body.model_dump(),
    )
    background_tasks.add_task(
        _run_job, job.id, body, current_user.id
    )
    return {"job_id": job.id, "status": "pending", "message": "Preprocessing job started"}


async def _run_job(job_id: int, body: PreprocessingConfig, user_id: int):
    from database import SessionLocal
    db = SessionLocal()
    try:
        update_job(db, job_id, status=JobStatus.RUNNING, progress=0.05)
        result = run_preprocessing_job(
            min_lat=body.min_lat, max_lat=body.max_lat,
            min_lon=body.min_lon, max_lon=body.max_lon,
            date_start=body.date_start, date_end=body.date_end,
            variables=body.variables,
            max_pixel_reliability=body.max_pixel_reliability,
            missing_strategy=body.missing_strategy,
            remove_outliers=body.remove_outliers,
            outlier_iqr_factor=body.outlier_iqr_factor,
            normalization=body.normalization,
            add_month=body.add_month,
            add_season=body.add_season,
            add_lag1=body.add_lag1,
            max_rows=body.max_rows,
            job_name=body.job_name,
            progress_callback=lambda p: update_job(db, job_id, progress=p),
        )
        update_job(
            db, job_id,
            status=JobStatus.COMPLETED,
            progress=1.0,
            result_path=result.get("output_path"),
        )
    except Exception as e:
        update_job(db, job_id, status=JobStatus.FAILED, error_message=str(e))
    finally:
        db.close()


@router.get("/jobs")
async def list_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all preprocessing jobs for current user."""
    jobs = (
        db.query(Job)
        .filter(Job.user_id == current_user.id, Job.job_type == JobType.PREPROCESSING)
        .order_by(Job.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": j.id,
            "name": j.name,
            "status": j.status,
            "progress": j.progress,
            "error": j.error_message,
            "result_path": j.result_path,
            "created_at": str(j.created_at),
            "completed_at": str(j.completed_at) if j.completed_at else None,
        }
        for j in jobs
    ]


@router.get("/jobs/{job_id}")
async def get_job_details(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get details and result of a specific preprocessing job."""
    job = get_job(db, job_id, user_id=current_user.id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    output = None
    if job.status == JobStatus.COMPLETED and job.result_path:
        import pandas as pd
        try:
            df = pd.read_parquet(job.result_path)
            output = {
                "rows": int(len(df)),
                "columns": list(df.columns),
                "path": job.result_path,
            }
        except Exception:
            output = {"path": job.result_path}

    return {
        "id": job.id,
        "name": job.name,
        "status": job.status,
        "progress": job.progress,
        "error": job.error_message,
        "config": json.loads(job.config_json) if job.config_json else None,
        "output": output,
        "created_at": str(job.created_at),
    }
