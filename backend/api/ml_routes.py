"""
TerraPulse AI — ML Routes
Training, evaluation, prediction, and experiment management.
"""

import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db, User, MLExperiment, JobStatus
from services.ml_service import (
    train_model, list_artifacts, load_artifact, predict_single,
    AVAILABLE_MODELS, DEFAULT_FEATURES,
)
from services.job_service import create_job, update_job

router = APIRouter(prefix="/api/ml", tags=["ml"])


class TrainRequest(BaseModel):
    experiment_name: str = "ndvi_experiment"
    model_type: str = "random_forest"
    target: str = "NDVI"
    features: List[str] = DEFAULT_FEATURES
    region: Dict[str, float]  # min_lat, max_lat, min_lon, max_lon
    date_start: str
    date_end: str
    test_split_date: str
    min_pixel_reliability: int = 1
    max_train_rows: int = 150_000


class PredictRequest(BaseModel):
    artifact_path: str
    feature_values: Dict[str, float]
    observed_value: Optional[float] = None


@router.get("/models")
async def get_available_models(current_user: User = Depends(get_current_user)):
    return {"models": AVAILABLE_MODELS, "default_features": DEFAULT_FEATURES}


@router.get("/experiments")
async def list_experiments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Admins can see all user experiments; standard users see their own
    query = db.query(MLExperiment)
    if current_user.role != "admin":
        query = query.filter(MLExperiment.user_id == current_user.id)

    experiments = query.order_by(MLExperiment.created_at.desc()).limit(100).all()
    return [
        {
            "id": e.id,
            "user_id": e.user_id,
            "name": e.name,
            "model_type": e.model_type,
            "target": e.target,
            "mae": e.mae,
            "rmse": e.rmse,
            "r2": e.r2,
            "train_samples": e.train_samples,
            "test_samples": e.test_samples,
            "artifact_path": e.artifact_path,
            "features": e.features_json,
            "created_at": str(e.created_at),
        }
        for e in experiments
    ]


@router.post("/train")
async def start_training(
    body: TrainRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start a model training job in the background."""
    if body.model_type not in AVAILABLE_MODELS:
        raise HTTPException(status_code=400, detail=f"Unknown model type: {body.model_type}")

    job = create_job(
        db=db,
        user_id=current_user.id,
        job_type="training",
        name=body.experiment_name,
        config=body.model_dump(),
    )

    background_tasks.add_task(
        _run_training_job, job.id, body, current_user.id
    )

    return {"job_id": job.id, "status": "pending", "message": "Training job started"}


async def _run_training_job(job_id: int, body: TrainRequest, user_id: int):
    """Background training task."""
    from database import SessionLocal
    db = SessionLocal()
    try:
        update_job(db, job_id, status=JobStatus.RUNNING, progress=0.1)

        result = train_model(
            model_type=body.model_type,
            features=body.features,
            target=body.target,
            region=body.region,
            date_start=body.date_start,
            date_end=body.date_end,
            test_split_date=body.test_split_date,
            min_pixel_reliability=body.min_pixel_reliability,
            max_train_rows=body.max_train_rows,
            experiment_name=body.experiment_name,
        )

        # Save experiment record
        experiment = MLExperiment(
            job_id=job_id,
            user_id=user_id,
            name=body.experiment_name,
            model_type=body.model_type,
            target=body.target,
            features_json=json.dumps(body.features),
            region_json=json.dumps(body.region),
            date_start=body.date_start,
            date_end=body.date_end,
            train_samples=result["train_samples"],
            test_samples=result["test_samples"],
            mae=result["metrics"]["mae"],
            rmse=result["metrics"]["rmse"],
            r2=result["metrics"]["r2"],
            artifact_path=result["artifact_path"],
        )
        db.add(experiment)
        db.commit()

        update_job(
            db, job_id,
            status=JobStatus.COMPLETED,
            progress=1.0,
            result_path=result["artifact_path"],
        )

    except Exception as e:
        update_job(db, job_id, status=JobStatus.FAILED, error_message=str(e))
    finally:
        db.close()


@router.get("/job/{job_id}")
async def get_job_status(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from services.job_service import get_job
    job = get_job(db, job_id, user_id=current_user.id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    result = None
    if job.status == JobStatus.COMPLETED and job.result_path:
        try:
            artifact = load_artifact(job.result_path)
            result = {
                "artifact_path": job.result_path,
                "metrics": artifact.get("metrics"),
                "features": artifact.get("features"),
                "model_type": artifact.get("model_type"),
            }
        except Exception:
            pass

    return {
        "job_id": job.id,
        "status": job.status,
        "progress": job.progress,
        "name": job.name,
        "error": job.error_message,
        "result": result,
        "created_at": str(job.created_at),
    }


@router.get("/artifacts")
async def get_artifacts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    all_artifacts = list_artifacts()

    # If the user is an admin, they have full visibility into all models
    if current_user.role == "admin":
        return {"artifacts": all_artifacts}

    # For standard users:
    # 1. Models trained by admins MUST NOT be listed to standard users.
    # 2. Standard users can only view and predict on their own models (or general non-admin models).
    admin_experiments = (
        db.query(MLExperiment.artifact_path)
        .join(User, MLExperiment.user_id == User.id)
        .filter(User.role == "admin")
        .all()
    )
    admin_artifact_paths = {row[0] for row in admin_experiments if row[0]}

    user_experiments = (
        db.query(MLExperiment.artifact_path)
        .filter(MLExperiment.user_id == current_user.id)
        .all()
    )
    user_artifact_paths = {row[0] for row in user_experiments if row[0]}

    # Filter out any artifact created by an admin
    filtered = []
    for art in all_artifacts:
        art_path = art.get("path")
        if art_path in admin_artifact_paths:
            continue  # Exclude models trained by admin
        if art_path not in user_artifact_paths:
            continue  # Exclude models not owned by the user
        filtered.append(art)

    return {"artifacts": filtered}


@router.post("/predict")
async def predict(
    body: PredictRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        return predict_single(body.artifact_path, body.feature_values)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
