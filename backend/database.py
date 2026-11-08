"""
TerraPulse AI — Database Models and Initialization
Uses SQLAlchemy with SQLite for user accounts, sessions, jobs, and audit logs.
"""

from sqlalchemy import (
    create_engine, Column, Integer, String, Boolean,
    DateTime, Text, Float, ForeignKey, Enum
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─────────────────────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class JobType(str, enum.Enum):
    PREPROCESSING = "preprocessing"
    TRAINING = "training"
    EXPLANATION = "explanation"
    EXPORT = "export"


# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(16), default=UserRole.USER, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    last_login = Column(DateTime, nullable=True)

    jobs = relationship("Job", back_populates="user")
    saved_regions = relationship("SavedRegion", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")


class SavedRegion(Base):
    __tablename__ = "saved_regions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(128), nullable=False)
    min_lat = Column(Float, nullable=False)
    max_lat = Column(Float, nullable=False)
    min_lon = Column(Float, nullable=False)
    max_lon = Column(Float, nullable=False)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="saved_regions")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_type = Column(String(32), nullable=False)
    status = Column(String(16), default=JobStatus.PENDING, nullable=False)
    name = Column(String(256), nullable=True)
    config_json = Column(Text, nullable=True)      # JSON config
    result_path = Column(String(512), nullable=True)
    error_message = Column(Text, nullable=True)
    progress = Column(Float, default=0.0)          # 0.0 – 1.0
    created_at = Column(DateTime, default=func.now())
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="jobs")


class MLExperiment(Base):
    __tablename__ = "ml_experiments"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(256), nullable=False)
    model_type = Column(String(64), nullable=False)
    target = Column(String(64), nullable=False)
    features_json = Column(Text, nullable=True)
    region_json = Column(Text, nullable=True)
    date_start = Column(String(16), nullable=True)
    date_end = Column(String(16), nullable=True)
    train_samples = Column(Integer, nullable=True)
    test_samples = Column(Integer, nullable=True)
    mae = Column(Float, nullable=True)
    rmse = Column(Float, nullable=True)
    r2 = Column(Float, nullable=True)
    artifact_path = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(128), nullable=False)
    detail = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="audit_logs")


# ─────────────────────────────────────────────────────────────────────────────
# DB Init
# ─────────────────────────────────────────────────────────────────────────────

def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency: yield a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
