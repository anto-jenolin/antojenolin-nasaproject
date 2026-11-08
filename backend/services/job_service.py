"""
TerraPulse AI — Job Service
Manages background job state in SQLite.
"""

import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from database import Job, JobStatus, JobType


def create_job(
    db: Session,
    user_id: int,
    job_type: str,
    name: str,
    config: Optional[Dict[str, Any]] = None,
) -> Job:
    job = Job(
        user_id=user_id,
        job_type=job_type,
        status=JobStatus.PENDING,
        name=name,
        config_json=json.dumps(config) if config else None,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def update_job(
    db: Session,
    job_id: int,
    status: Optional[str] = None,
    progress: Optional[float] = None,
    result_path: Optional[str] = None,
    error_message: Optional[str] = None,
) -> Optional[Job]:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return None

    if status:
        job.status = status
        if status == JobStatus.RUNNING:
            job.started_at = datetime.now(timezone.utc)
        elif status in (JobStatus.COMPLETED, JobStatus.FAILED):
            job.completed_at = datetime.now(timezone.utc)

    if progress is not None:
        job.progress = progress
    if result_path:
        job.result_path = result_path
    if error_message:
        job.error_message = error_message

    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, job_id: int, user_id: Optional[int] = None) -> Optional[Job]:
    q = db.query(Job).filter(Job.id == job_id)
    if user_id is not None:
        q = q.filter(Job.user_id == user_id)
    return q.first()


def list_jobs(
    db: Session,
    user_id: Optional[int] = None,
    job_type: Optional[str] = None,
    limit: int = 50,
) -> list:
    q = db.query(Job).order_by(Job.created_at.desc())
    if user_id is not None:
        q = q.filter(Job.user_id == user_id)
    if job_type:
        q = q.filter(Job.job_type == job_type)
    return q.limit(limit).all()
