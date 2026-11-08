"""
TerraPulse AI — Admin Routes
Administrator-only endpoints for user management, job monitoring, audit logs.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from auth import require_admin, hash_password
from database import get_db, User, UserRole, Job, AuditLog

router = APIRouter(prefix="/api/admin", tags=["admin"])


class UpdateUserRequest(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[str] = None  # admin can change user roles


class CreateUserRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "user"


@router.get("/users")
async def list_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": str(u.created_at),
            "last_login": str(u.last_login) if u.last_login else None,
        }
        for u in users
    ]


@router.post("/users")
async def create_user(
    body: CreateUserRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if body.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'")

    existing = db.query(User).filter(
        (User.username == body.username) | (User.email == body.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already exists")

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username, "role": user.role}


@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    body: UpdateUserRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.is_active is not None:
        user.is_active = body.is_active
    if body.role is not None:
        if body.role not in ("admin", "user"):
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role = body.role

    db.commit()
    return {"id": user.id, "username": user.username, "role": user.role, "is_active": user.is_active}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": f"User {user_id} deleted"}


@router.get("/jobs")
async def list_all_jobs(
    status: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(Job).order_by(Job.created_at.desc())
    if status:
        q = q.filter(Job.status == status)
    if job_type:
        q = q.filter(Job.job_type == job_type)

    jobs = q.limit(limit).all()
    return [
        {
            "id": j.id,
            "user_id": j.user_id,
            "type": j.job_type,
            "status": j.status,
            "name": j.name,
            "progress": j.progress,
            "error": j.error_message,
            "created_at": str(j.created_at),
        }
        for j in jobs
    ]


@router.get("/audit")
async def get_audit_logs(
    limit: int = Query(200, le=1000),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "action": l.action,
            "detail": l.detail,
            "ip": l.ip_address,
            "created_at": str(l.created_at),
        }
        for l in logs
    ]


@router.get("/system")
async def system_status(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Return system health information."""
    from services.duckdb_service import discover_files, PARQUET_DIR
    from services.chat_service import get_provider_status
    from pathlib import Path

    files = discover_files()
    user_count = db.query(User).count()
    job_count = db.query(Job).count()

    return {
        "dataset": {
            "parquet_dir": str(PARQUET_DIR),
            "file_count": len(files),
            "total_size_gb": round(sum(f["size_mb"] for f in files) / 1024, 2),
        },
        "llm": get_provider_status(),
        "users": user_count,
        "total_jobs": job_count,
    }
