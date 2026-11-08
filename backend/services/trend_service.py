"""
TerraPulse AI — Trend Service
Provides time‑series extraction and statistical trend analysis for Earth science variables.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime

from services.duckdb_service import query_time_series
from scipy.stats import linregress

# Optional Mann‑Kendall test – imported lazily to avoid heavy dependency if not used
try:
    import pymannkendall as mk
    _MANN_KENDALL_AVAILABLE = True
except Exception:
    _MANN_KENDALL_AVAILABLE = False


def _prepare_series(series: List[Dict[str, Any]]) -> List[tuple]:
    """Convert DuckDB time‑series output to (timestamp, value) tuples, dropping nulls.
    Expected input format: [{"date": "YYYY‑MM‑DD", "mean": float, ...}, ...]
    """
    points = []
    for entry in series:
        val = entry.get("mean")
        if val is None:
            continue
        # Parse ISO date string
        try:
            ts = datetime.fromisoformat(entry["date"]).timestamp()
        except Exception:
            # Fallback: assume YYYY‑MM‑DD
            ts = datetime.strptime(entry["date"], "%Y-%m-%d").timestamp()
        points.append((ts, float(val)))
    return points


def compute_trend(
    variable: str,
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    date_start: Optional[str] = None,
    date_end: Optional[str] = None,
    min_pixel_reliability: Optional[int] = None,
    mann_kendall: bool = False,
) -> Dict[str, Any]:
    """Fetch a time‑series for *variable* over the supplied region and compute:
    * Linear regression (slope, intercept, r‑value, p‑value, std‑err).
    * Optional Mann‑Kendall trend test.
    Returns a JSON‑serialisable dict.
    """
    # Get raw series from DuckDB (mean monthly values)
    series = query_time_series(
        variable=variable,
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
        date_start=date_start,
        date_end=date_end,
        min_pixel_reliability=min_pixel_reliability,
    )

    if not series:
        raise ValueError("No data returned for the selected region/variable.")

    points = _prepare_series(series)
    if len(points) < 2:
        raise ValueError("Insufficient data points for trend analysis.")

    times, values = zip(*points)
    # Linear regression on timestamps
    lr = linregress(times, values)
    # Convert slope from per‑second to per‑year for readability
    seconds_per_year = 365.25 * 24 * 3600
    slope_per_year = lr.slope * seconds_per_year

    trend_result = {
        "variable": variable,
        "region": {
            "min_lat": min_lat,
            "max_lat": max_lat,
            "min_lon": min_lon,
            "max_lon": max_lon,
        },
        "time_series": series,
        "trend": {
            "method": "linear",
            "slope_per_year": round(slope_per_year, 6),
            "intercept": round(lr.intercept, 6),
            "r_value": round(lr.rvalue, 6),
            "p_value": round(lr.pvalue, 6),
            "std_err": round(lr.stderr, 6),
        },
    }

    if mann_kendall:
        if not _MANN_KENDALL_AVAILABLE:
            trend_result["mann_kendall"] = {
                "error": "pymannkendall library not available. Install it to use this test."
            }
        else:
            mk_result = mk.original_test([v for _, v in points])
            trend_result["mann_kendall"] = {
                "tau": round(mk_result.Tau, 6),
                "p_value": round(mk_result.p, 6),
                "trend": mk_result.trend,  # "increasing", "decreasing" or "no trend"
                "method": "mann_kendall",
            }
    return trend_result
