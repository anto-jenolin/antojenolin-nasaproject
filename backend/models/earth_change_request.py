from pydantic import BaseModel, Field
from typing import Optional

class EarthChangeRequest(BaseModel):
    variable: str = Field(..., description="Variable name (e.g., 'NDVI')")
    min_lat: float = Field(..., ge=-90, le=90, description="South latitude bound")
    max_lat: float = Field(..., ge=-90, le=90, description="North latitude bound")
    min_lon: float = Field(..., ge=-180, le=180, description="West longitude bound")
    max_lon: float = Field(..., ge=-180, le=180, description="East longitude bound")
    date_start: Optional[str] = Field(None, description="ISO date start (inclusive)")
    date_end: Optional[str] = Field(None, description="ISO date end (inclusive)")
    min_pixel_reliability: Optional[int] = Field(None, ge=0, le=3, description="Quality filter")
    significance_alpha: float = Field(0.05, ge=0.0, le=1.0, description="Significance level for statistical test")
    mann_kendall: bool = Field(False, description="Whether to compute Mann‑Kendall test")
