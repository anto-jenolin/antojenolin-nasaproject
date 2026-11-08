"""
TerraPulse AI — DuckDB Service
Manages a persistent DuckDB connection and provides safe query helpers
for regional, temporal, and variable-filtered access to 319 Parquet files.

IMPORTANT: Scale factors and fill values have ALREADY been applied during
HDF → Parquet conversion. Do NOT re-apply them here.
"""

import duckdb
import os
from pathlib import Path
from typing import List, Optional, Dict, Any
import pyarrow.parquet as pq

from config import settings


# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

PARQUET_DIR = settings.resolved_parquet_dir

ALL_VARIABLES = [
    "NDVI", "EVI", "VI_Quality",
    "Red_Reflectance", "NIR_Reflectance", "Blue_Reflectance", "MIR_Reflectance",
    "Avg_Sun_Zenith_Angle", "NDVI_StdDev", "EVI_StdDev",
    "Pixels_Used", "Pixels_30deg_VZ", "Pixel_Reliability"
]

NUMERIC_VARIABLES = [
    "NDVI", "EVI", "Red_Reflectance", "NIR_Reflectance",
    "Blue_Reflectance", "MIR_Reflectance", "Avg_Sun_Zenith_Angle",
    "NDVI_StdDev", "EVI_StdDev"
]

# Approximate valid ranges (post-scale-factor application)
VARIABLE_RANGES = {
    "NDVI": (-0.2, 1.0),
    "EVI": (-0.2, 1.0),
    "Red_Reflectance": (0.0, 1.6),
    "NIR_Reflectance": (0.0, 1.6),
    "Blue_Reflectance": (0.0, 1.6),
    "MIR_Reflectance": (0.0, 1.6),
    "Avg_Sun_Zenith_Angle": (0.0, 90.0),
    "NDVI_StdDev": (0.0, 0.5),
    "EVI_StdDev": (0.0, 0.5),
}

VARIABLE_DESCRIPTIONS = {
    "NDVI": "Normalized Difference Vegetation Index (-0.2 to 1.0, NaN = no data)",
    "EVI": "Enhanced Vegetation Index (-0.2 to 1.0, NaN = no data)",
    "VI_Quality": "VI Quality bitmask (integer flags)",
    "Red_Reflectance": "Red band surface reflectance (0–1.6)",
    "NIR_Reflectance": "Near-infrared surface reflectance (0–1.6)",
    "Blue_Reflectance": "Blue band surface reflectance (0–1.6)",
    "MIR_Reflectance": "Mid-infrared surface reflectance (0–1.6)",
    "Avg_Sun_Zenith_Angle": "Average solar zenith angle in degrees (0–90)",
    "NDVI_StdDev": "NDVI standard deviation within the CMG pixel",
    "EVI_StdDev": "EVI standard deviation within the CMG pixel",
    "Pixels_Used": "Count of 1km pixels used in compositing",
    "Pixels_30deg_VZ": "Count of 1km pixels with viewing zenith ≤30°",
    "Pixel_Reliability": "Summary QA: 0=Good, 1=Marginal, 2=Snow/Ice, 3=Cloudy",
}

MAX_PREVIEW_ROWS = 10_000
MAX_REGIONAL_ROWS = 500_000  # Max rows returned to browser


# ─────────────────────────────────────────────────────────────────────────────
# Connection
# ─────────────────────────────────────────────────────────────────────────────

_con: Optional[duckdb.DuckDBPyConnection] = None


def get_connection() -> duckdb.DuckDBPyConnection:
    global _con
    if _con is None:
        _con = duckdb.connect(database=":memory:")
        _con.execute("SET threads TO 8")
        _con.execute("SET memory_limit = '4GB'")
        _con.execute("PRAGMA enable_progress_bar=false")
    return _con.cursor()


# ─────────────────────────────────────────────────────────────────────────────
# File Catalog
# ─────────────────────────────────────────────────────────────────────────────

def discover_files() -> List[Dict[str, Any]]:
    """Return catalog of all Parquet files with date info and size."""
    import re
    files = []
    if not PARQUET_DIR.exists():
        return files

    for f in sorted(PARQUET_DIR.glob("*.parquet")):
        m = re.search(r"A(\d{4})(\d{3})", f.name)
        if m:
            year = int(m.group(1))
            doy = int(m.group(2))
            import pandas as pd
            date = pd.Timestamp(year=year, month=1, day=1) + pd.Timedelta(days=doy - 1)
            date_str = date.strftime("%Y-%m-%d")
        else:
            date_str = "unknown"

        files.append({
            "filename": f.name,
            "path": str(f),
            "date": date_str,
            "size_mb": round(f.stat().st_size / (1024 * 1024), 2),
        })
    return files


def get_parquet_glob() -> str:
    """Return DuckDB glob pattern for all Parquet files."""
    return str(PARQUET_DIR / "*.parquet").replace("\\", "/")


def get_parquet_source(date_start: Optional[str] = None, date_end: Optional[str] = None) -> str:
    """Return filtered list of parquet file paths or glob pattern for fast temporal pruning."""
    if not (date_start or date_end):
        return f"'{get_parquet_glob()}'"

    files = discover_files()
    matched = []
    for f in files:
        f_date = f.get("date", "unknown")
        if f_date == "unknown":
            continue
        if date_start and f_date < date_start:
            continue
        if date_end and f_date > date_end:
            continue
        matched.append(f["path"].replace("\\", "/"))

    if not matched:
        return f"'{get_parquet_glob()}'"
    return str(matched)


# ─────────────────────────────────────────────────────────────────────────────
# Schema Inspection
# ─────────────────────────────────────────────────────────────────────────────

def inspect_schema() -> Dict[str, Any]:
    """Inspect schema from the first Parquet file without loading all data."""
    files = list(PARQUET_DIR.glob("*.parquet"))
    if not files:
        return {"error": "No Parquet files found"}

    sample_file = str(sorted(files)[0])
    schema = pq.read_schema(sample_file)

    columns = []
    for i, name in enumerate(schema.names):
        field = schema.field(i)
        columns.append({
            "name": name,
            "type": str(field.type),
            "description": VARIABLE_DESCRIPTIONS.get(name, ""),
        })

    return {
        "columns": columns,
        "total_columns": len(columns),
        "sample_file": Path(sample_file).name,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Regional Query Builder
# ─────────────────────────────────────────────────────────────────────────────

def build_region_where(
    min_lat: Optional[float] = None,
    max_lat: Optional[float] = None,
    min_lon: Optional[float] = None,
    max_lon: Optional[float] = None,
    date_start: Optional[str] = None,
    date_end: Optional[str] = None,
    min_pixel_reliability: Optional[int] = None,
    exclude_nulls: bool = True,
    target_variable: str = "NDVI",
) -> str:
    """Build a WHERE clause for regional and temporal filtering."""
    clauses = []

    if min_lat is not None:
        clauses.append(f"Latitude >= {min_lat}")
    if max_lat is not None:
        clauses.append(f"Latitude <= {max_lat}")
    if min_lon is not None:
        clauses.append(f"Longitude >= {min_lon}")
    if max_lon is not None:
        clauses.append(f"Longitude <= {max_lon}")
    if date_start:
        clauses.append(f"Date >= DATE '{date_start}'")
    if date_end:
        clauses.append(f"Date <= DATE '{date_end}'")
    if min_pixel_reliability is not None:
        clauses.append(
            f"Pixel_Reliability IS NOT NULL AND Pixel_Reliability <= {min_pixel_reliability}"
        )
    if exclude_nulls and target_variable in ALL_VARIABLES:
        clauses.append(f"{target_variable} IS NOT NULL")

    return "WHERE " + " AND ".join(clauses) if clauses else ""


# ─────────────────────────────────────────────────────────────────────────────
# Aggregated Grid Query (for map rendering)
# ─────────────────────────────────────────────────────────────────────────────

def query_aggregated_grid(
    variable: str = "NDVI",
    grid_resolution: float = 0.5,
    min_lat: Optional[float] = None,
    max_lat: Optional[float] = None,
    min_lon: Optional[float] = None,
    max_lon: Optional[float] = None,
    date_start: Optional[str] = None,
    date_end: Optional[str] = None,
    min_pixel_reliability: Optional[int] = None,
) -> List[Dict]:
    """
    Return a spatially aggregated grid suitable for map display.
    Never returns pixel-level data to the browser.
    """
    if variable not in ALL_VARIABLES:
        raise ValueError(f"Unknown variable: {variable}")

    where = build_region_where(
        min_lat=min_lat, max_lat=max_lat,
        min_lon=min_lon, max_lon=max_lon,
        date_start=date_start, date_end=date_end,
        min_pixel_reliability=min_pixel_reliability,
        target_variable=variable,
    )

    source = get_parquet_source(date_start, date_end)
    res = grid_resolution

    sql = f"""
        SELECT
            ROUND(Latitude / {res}) * {res} AS lat_center,
            ROUND(Longitude / {res}) * {res} AS lon_center,
            AVG({variable}) AS mean_val,
            COUNT(*) AS obs_count
        FROM read_parquet({source})
        {where}
        GROUP BY lat_center, lon_center
        ORDER BY lat_center, lon_center
    """

    con = get_connection()
    result = con.execute(sql + " LIMIT 500000").fetchall()
    return [
        {"lat": r[0], "lon": r[1], "value": r[2], "count": r[3]}
        for r in result
        if r[2] is not None
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Time-Series Query
# ─────────────────────────────────────────────────────────────────────────────

def query_time_series(
    variable: str = "NDVI",
    min_lat: Optional[float] = None,
    max_lat: Optional[float] = None,
    min_lon: Optional[float] = None,
    max_lon: Optional[float] = None,
    date_start: Optional[str] = None,
    date_end: Optional[str] = None,
    min_pixel_reliability: Optional[int] = None,
) -> List[Dict]:
    """Return monthly mean of a variable for the selected region."""
    if variable not in ALL_VARIABLES:
        raise ValueError(f"Unknown variable: {variable}")

    where = build_region_where(
        min_lat=min_lat, max_lat=max_lat,
        min_lon=min_lon, max_lon=max_lon,
        date_start=date_start, date_end=date_end,
        min_pixel_reliability=min_pixel_reliability,
        target_variable=variable,
    )

    source = get_parquet_source(date_start, date_end)

    sql = f"""
        SELECT
            Date,
            AVG({variable}) AS mean_val,
            STDDEV({variable}) AS std_val,
            COUNT(*) AS pixel_count
        FROM read_parquet({source})
        {where}
        GROUP BY Date
        ORDER BY Date
    """

    con = get_connection()
    result = con.execute(sql).fetchall()
    return [
        {
            "date": str(r[0])[:10],
            "mean": round(r[1], 6) if r[1] is not None else None,
            "std": round(r[2], 6) if r[2] is not None else None,
            "pixel_count": r[3],
        }
        for r in result
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Preview Query
# ─────────────────────────────────────────────────────────────────────────────

def query_preview(
    min_lat: Optional[float] = None,
    max_lat: Optional[float] = None,
    min_lon: Optional[float] = None,
    max_lon: Optional[float] = None,
    date_start: Optional[str] = None,
    date_end: Optional[str] = None,
    columns: Optional[List[str]] = None,
    limit: int = 1000,
) -> List[Dict]:
    """Return a bounded sample of records for a region."""
    limit = min(limit, MAX_PREVIEW_ROWS)
    cols = columns if columns else ["Date", "Latitude", "Longitude", "NDVI", "EVI", "Pixel_Reliability"]

    # Validate column names
    valid_cols = {"Date", "Latitude", "Longitude"} | set(ALL_VARIABLES)
    cols = [c for c in cols if c in valid_cols]

    where = build_region_where(
        min_lat=min_lat, max_lat=max_lat,
        min_lon=min_lon, max_lon=max_lon,
        date_start=date_start, date_end=date_end,
        exclude_nulls=False,
    )

    glob = get_parquet_glob()
    col_str = ", ".join(cols)

    sql = f"""
        SELECT {col_str}
        FROM read_parquet('{glob}')
        {where}
        LIMIT {limit}
    """

    con = get_connection()
    rows = con.execute(sql).fetchall()
    return [dict(zip(cols, r)) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# Quality Summary
# ─────────────────────────────────────────────────────────────────────────────

def query_quality_summary(
    min_lat: Optional[float] = None,
    max_lat: Optional[float] = None,
    min_lon: Optional[float] = None,
    max_lon: Optional[float] = None,
    date_start: Optional[str] = None,
    date_end: Optional[str] = None,
) -> Dict[str, Any]:
    """Return quality distribution and null statistics for a region."""
    where = build_region_where(
        min_lat=min_lat, max_lat=max_lat,
        min_lon=min_lon, max_lon=max_lon,
        date_start=date_start, date_end=date_end,
        exclude_nulls=False,
    )

    glob = get_parquet_glob()

    sql = f"""
        SELECT
            COUNT(*) AS total_rows,
            COUNT(NDVI) AS valid_ndvi,
            COUNT(EVI) AS valid_evi,
            COUNT(Pixel_Reliability) AS valid_reliability,
            SUM(CASE WHEN Pixel_Reliability = 0 THEN 1 ELSE 0 END) AS good_data,
            SUM(CASE WHEN Pixel_Reliability = 1 THEN 1 ELSE 0 END) AS marginal_data,
            SUM(CASE WHEN Pixel_Reliability = 2 THEN 1 ELSE 0 END) AS snow_ice,
            SUM(CASE WHEN Pixel_Reliability = 3 THEN 1 ELSE 0 END) AS cloudy,
            AVG(NDVI) AS mean_ndvi,
            MIN(NDVI) AS min_ndvi,
            MAX(NDVI) AS max_ndvi,
            MIN(Date) AS date_start,
            MAX(Date) AS date_end
        FROM read_parquet('{glob}')
        {where}
    """

    con = get_connection()
    r = con.execute(sql).fetchone()

    if not r or r[0] == 0:
        return {"error": "No data found for the selected region and period"}

    total = r[0] or 1
    return {
        "total_rows": r[0],
        "valid_ndvi": r[1],
        "valid_evi": r[2],
        "null_ndvi_pct": round(100 * (1 - r[1] / total), 2),
        "pixel_reliability": {
            "good": r[4],
            "marginal": r[5],
            "snow_ice": r[6],
            "cloudy": r[7],
        },
        "ndvi_stats": {
            "mean": round(r[8], 6) if r[8] else None,
            "min": round(r[9], 6) if r[9] else None,
            "max": round(r[10], 6) if r[10] else None,
        },
        "temporal_coverage": {
            "start": str(r[11])[:10] if r[11] else None,
            "end": str(r[12])[:10] if r[12] else None,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Dataset for ML Training
# ─────────────────────────────────────────────────────────────────────────────

def query_training_data(
    features: List[str],
    target: str,
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    date_start: str,
    date_end: str,
    min_pixel_reliability: int = 1,
    max_rows: int = 200_000,
) -> "pd.DataFrame":
    """
    Return a bounded, quality-filtered DataFrame for ML training.
    Uses TABLESAMPLE to bound rows when the region is large.
    """
    import pandas as pd

    all_cols = list(set(features + [target, "Date", "Latitude", "Longitude"]))
    valid_cols = {"Date", "Latitude", "Longitude"} | set(ALL_VARIABLES)
    all_cols = [c for c in all_cols if c in valid_cols]

    where = build_region_where(
        min_lat=min_lat, max_lat=max_lat,
        min_lon=min_lon, max_lon=max_lon,
        date_start=date_start, date_end=date_end,
        min_pixel_reliability=min_pixel_reliability,
        target_variable=target,
    )
    # Add feature null check
    for f in features:
        if f in NUMERIC_VARIABLES:
            where += f" AND {f} IS NOT NULL"

    source = get_parquet_source(date_start, date_end)
    col_str = ", ".join(all_cols)

    # Use uniform Bernoulli sampling without an early-stopping LIMIT so all dates are sampled
    sample_pct = min(10.0, max(0.5, round((max_rows / 4_000_000) * 100, 2)))
    sql = f"""
        SELECT {col_str}
        FROM read_parquet({source})
        {where}
        USING SAMPLE {sample_pct}% (bernoulli)
    """

    con = get_connection()
    return con.execute(sql).df()
