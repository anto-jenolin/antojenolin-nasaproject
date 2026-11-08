# backend/models/earth_change.py
"""Pydantic models for the Earth Change Explorer API"""

from datetime import date
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field, validator


class VariableInfo(BaseModel):
    id: str = Field(..., description="Machine‑readable variable identifier")
    name: str = Field(..., description="Human‑readable name")
    description: str = Field(..., description="Short description of the variable")
    units: str = Field(..., description="Units of the variable")
    temporal_resolution: str = Field(..., description="Temporal resolution (e.g., monthly)")
    spatial_resolution: str = Field(..., description="Spatial resolution (e.g., 1 km)")
    source: str = Field(..., description="Data source / product name")


class RegionSpec(BaseModel):
    min_lat: Optional[float] = Field(None, ge=-90, le=90, description="South latitude bound")
    max_lat: Optional[float] = Field(None, ge=-90, le=90, description="North latitude bound")
    min_lon: Optional[float] = Field(None, ge=-180, le=180, description="West longitude bound")
    max_lon: Optional[float] = Field(None, ge=-180, le=180, description="East longitude bound")

    @validator("max_lat")
    def check_lat_order(cls, v, values):
        min_lat = values.get("min_lat")
        if min_lat is not None and v is not None and v < min_lat:
            raise ValueError("max_lat must be >= min_lat")
        return v

    @validator("max_lon")
    def check_lon_order(cls, v, values):
        min_lon = values.get("min_lon")
        if min_lon is not None and v is not None and v < min_lon:
            raise ValueError("max_lon must be >= min_lon")
        return v


class TimeSeriesPoint(BaseModel):
    date: date = Field(..., description="ISO date for the aggregated period")
    mean: Optional[float] = Field(None, description="Mean value for the period")
    std: Optional[float] = Field(None, description="Standard deviation of the period")
    pixel_count: int = Field(..., description="Number of observations used for this period")


class LinearTrendResult(BaseModel):
    slope: float = Field(..., description="Slope per month")
    intercept: float = Field(..., description="Intercept of the regression line")
    p_value: float = Field(..., description="Two‑sided p‑value")
    r_squared: float = Field(..., description="Coefficient of determination")
    std_err: float = Field(..., description="Standard error of the slope")


class MannKendallResult(BaseModel):
    trend: str = Field(..., description="Trend direction: increasing / decreasing / no trend")
    p_value: float = Field(..., description="Two‑sided p‑value")
    sen_slope: float = Field(..., description="Sen's slope (per month)")


class AnalysisStatistics(BaseModel):
    linear: Optional[LinearTrendResult] = None
    mann_kendall: Optional[MannKendallResult] = None
    significance: Optional[str] = Field(
        None, description="Overall significance label (significant / not significant)"
    )
    observations: int = Field(..., description="Count of non‑null observations used in analysis")


class AnalyzeRequest(BaseModel):
    variable: str = Field(..., description="Variable identifier, e.g. 'NDVI'")
    date_start: date = Field(..., description="Start of the analysis period (inclusive)")
    date_end: date = Field(..., description="End of the analysis period (inclusive)")
    region: Optional[RegionSpec] = None
    min_pixel_reliability: int = Field(0, ge=0, le=3, description="Maximum pixel reliability flag to keep (0=good … 3=cloudy)")
    significance_alpha: float = Field(0.05, gt=0, lt=1, description="Alpha threshold for significance")
    use_mann_kendall: bool = Field(False, description="Whether to compute Mann‑Kendall test")

    @validator("date_end")
    def check_date_range(cls, v, values):
        if "date_start" in values and v < values["date_start"]:
            raise ValueError("date_end must be >= date_start")
        return v


class AnalyzeResponse(BaseModel):
    variable: str
    region: RegionSpec = Field(default_factory=RegionSpec)
    date_range: Dict[str, date]
    time_series: List[TimeSeriesPoint]
    statistics: AnalysisStatistics


class ExportResponse(BaseModel):
    download_url: Optional[str] = Field(None, description="Temporary URL to download the CSV file (optional)")
    filename: Optional[str] = Field(None, description="Suggested filename for the client (optional)")
    csv: str = Field(..., description="CSV content for direct download")

# End of file
