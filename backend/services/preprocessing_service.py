"""
TerraPulse AI — Preprocessing Service
Handles missing value strategies, quality filtering, outlier detection,
normalisation, and feature engineering on bounded DuckDB query results.

All data access is bounded to MAX_ROWS — never the full 8-billion-row dataset.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import numpy as np
import pandas as pd

from config import settings
from services.duckdb_service import (
    query_preview, ALL_VARIABLES, NUMERIC_VARIABLES
)

DERIVED_DIR = Path(settings.DERIVED_DIR) / "preprocessed"
DERIVED_DIR.mkdir(parents=True, exist_ok=True)

MISSING_STRATEGIES = {
    "drop": "Drop rows with any missing value in selected variables",
    "fill_mean": "Fill missing values with the column mean",
    "fill_median": "Fill missing values with the column median",
    "interpolate": "Linearly interpolate missing values (time-ordered)",
}

NORMALIZATION_METHODS = {
    "none": "No normalisation",
    "minmax": "Min-Max scaling to [0, 1]",
    "zscore": "Z-score standardisation (mean=0, std=1)",
}

SEASON_MAP = {12: "DJF", 1: "DJF", 2: "DJF",
              3: "MAM", 4: "MAM", 5: "MAM",
              6: "JJA", 7: "JJA", 8: "JJA",
              9: "SON", 10: "SON", 11: "SON"}

SEASON_NUM_MAP = {12: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 1,
                   6: 2, 7: 2, 8: 2, 9: 3, 10: 3, 11: 3}


def _load_data(
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    date_start: str,
    date_end: str,
    variables: List[str],
    max_pixel_reliability: int,
    limit: int,
) -> pd.DataFrame:
    """Load bounded raw data from DuckDB into a DataFrame."""
    cols = list({"Date", "Latitude", "Longitude"} | set(variables) | {"Pixel_Reliability"})
    rows = query_preview(
        min_lat=min_lat, max_lat=max_lat,
        min_lon=min_lon, max_lon=max_lon,
        date_start=date_start, date_end=date_end,
        columns=cols,
        limit=limit,
    )
    if not rows:
        raise ValueError("No data found for the selected region and period.")

    df = pd.DataFrame(rows)

    # Quality filter
    if "Pixel_Reliability" in df.columns:
        df = df[
            df["Pixel_Reliability"].isna() |
            (df["Pixel_Reliability"] <= max_pixel_reliability)
        ]

    return df


def _apply_missing(df: pd.DataFrame, variables: List[str], strategy: str) -> pd.DataFrame:
    """Apply missing value strategy to numeric variable columns."""
    num_cols = [c for c in variables if c in NUMERIC_VARIABLES and c in df.columns]

    if strategy == "drop":
        df = df.dropna(subset=num_cols)
    elif strategy == "fill_mean":
        for col in num_cols:
            df[col] = df[col].fillna(df[col].mean())
    elif strategy == "fill_median":
        for col in num_cols:
            df[col] = df[col].fillna(df[col].median())
    elif strategy == "interpolate":
        # Sort by date first, then interpolate
        if "Date" in df.columns:
            df = df.sort_values("Date").reset_index(drop=True)
        for col in num_cols:
            df[col] = df[col].interpolate(method="linear", limit_direction="both")
    return df


def _remove_outliers_iqr(
    df: pd.DataFrame, variables: List[str], factor: float
) -> pd.DataFrame:
    """Remove rows where any numeric variable is beyond factor × IQR from Q1/Q3."""
    num_cols = [c for c in variables if c in NUMERIC_VARIABLES and c in df.columns]
    mask = pd.Series([True] * len(df), index=df.index)
    for col in num_cols:
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1
        lo = q1 - factor * iqr
        hi = q3 + factor * iqr
        mask = mask & df[col].between(lo, hi)
    return df[mask].reset_index(drop=True)


def _normalize(df: pd.DataFrame, variables: List[str], method: str) -> tuple[pd.DataFrame, dict]:
    """Normalise numeric variables. Returns (normalised df, stats dict)."""
    num_cols = [c for c in variables if c in NUMERIC_VARIABLES and c in df.columns]
    stats: dict = {}

    if method == "minmax":
        for col in num_cols:
            lo = df[col].min()
            hi = df[col].max()
            rng = hi - lo if hi != lo else 1.0
            df[col] = (df[col] - lo) / rng
            stats[col] = {"min": float(lo), "max": float(hi)}
    elif method == "zscore":
        for col in num_cols:
            mu = df[col].mean()
            sigma = df[col].std()
            if sigma == 0:
                sigma = 1.0
            df[col] = (df[col] - mu) / sigma
            stats[col] = {"mean": float(mu), "std": float(sigma)}

    return df, stats


def _add_features(
    df: pd.DataFrame,
    add_month: bool,
    add_season: bool,
    add_lag1: bool,
    variables: List[str],
) -> pd.DataFrame:
    """Add temporal and lag features."""
    if "Date" in df.columns:
        dt = pd.to_datetime(df["Date"])
        if add_month:
            df["Month"] = dt.dt.month
        if add_season:
            df["Season"] = dt.dt.month.map(SEASON_NUM_MAP)
    if add_lag1:
        df = df.sort_values("Date").reset_index(drop=True)
        for col in [c for c in variables if c in NUMERIC_VARIABLES and c in df.columns]:
            df[f"{col}_lag1"] = df[col].shift(1)
    return df


def preview_preprocessing(
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    date_start: str,
    date_end: str,
    variables: List[str],
    max_pixel_reliability: int,
    missing_strategy: str,
    remove_outliers: bool,
    outlier_iqr_factor: float,
    normalization: str,
    limit: int = 500,
) -> Dict[str, Any]:
    """Return before/after statistics without saving any output."""
    raw = _load_data(
        min_lat, max_lat, min_lon, max_lon,
        date_start, date_end, variables, max_pixel_reliability, limit
    )

    num_cols = [c for c in variables if c in NUMERIC_VARIABLES and c in raw.columns]

    def _describe(df: pd.DataFrame) -> dict:
        out: dict = {"rows": len(df), "columns": list(df.columns)}
        for col in num_cols:
            if col in df.columns:
                s = df[col].dropna()
                out[col] = {
                    "mean": round(float(s.mean()), 4) if len(s) else None,
                    "std": round(float(s.std()), 4) if len(s) else None,
                    "null_pct": round(100 * df[col].isna().mean(), 2),
                }
        return out

    before = _describe(raw)
    processed = _apply_missing(raw.copy(), variables, missing_strategy)
    if remove_outliers and len(processed) > 0:
        processed = _remove_outliers_iqr(processed, variables, outlier_iqr_factor)
    processed, norm_stats = _normalize(processed, variables, normalization)
    after = _describe(processed)

    return {
        "before": before,
        "after": after,
        "rows_removed": before["rows"] - after["rows"],
        "norm_stats": norm_stats,
        "sample": processed.head(50).to_dict(orient="records"),
    }


def run_preprocessing_job(
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    date_start: str,
    date_end: str,
    variables: List[str],
    max_pixel_reliability: int,
    missing_strategy: str,
    remove_outliers: bool,
    outlier_iqr_factor: float,
    normalization: str,
    add_month: bool,
    add_season: bool,
    add_lag1: bool,
    max_rows: int,
    job_name: str,
    progress_callback: Optional[Callable[[float], None]] = None,
) -> Dict[str, Any]:
    """Full preprocessing pipeline — saves output as Parquet in DERIVED_DIR."""

    def _progress(p: float):
        if progress_callback:
            progress_callback(p)

    _progress(0.1)
    df = _load_data(
        min_lat, max_lat, min_lon, max_lon,
        date_start, date_end, variables, max_pixel_reliability, max_rows
    )
    raw_rows = len(df)
    _progress(0.4)

    df = _apply_missing(df, variables, missing_strategy)
    _progress(0.55)

    if remove_outliers and len(df) > 0:
        df = _remove_outliers_iqr(df, variables, outlier_iqr_factor)
    _progress(0.7)

    df, norm_stats = _normalize(df, variables, normalization)
    _progress(0.8)

    df = _add_features(df, add_month, add_season, add_lag1, variables)
    _progress(0.9)

    # Save output
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_name = f"{job_name}_{ts}.parquet"
    out_path = str(DERIVED_DIR / out_name)
    df.to_parquet(out_path, index=False, compression="zstd")
    _progress(1.0)

    return {
        "output_path": out_path,
        "raw_rows": raw_rows,
        "output_rows": len(df),
        "output_columns": list(df.columns),
        "norm_stats": norm_stats,
    }
