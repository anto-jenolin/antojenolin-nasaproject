from pydantic import BaseModel, Field
from typing import Optional

class TrendRequest(BaseModel):
    variable: str = Field(..., description="Variable name as used in the dataset (e.g., 'LST_Day_1km')")
    min_lat: float = Field(..., ge=-90, le=90, description="South latitude bound")
    max_lat: float = Field(..., ge=-90, le=90, description="North latitude bound")
    min_lon: float = Field(..., ge=-180, le=180, description="West longitude bound")
    max_lon: float = Field(..., ge=-180, le=180, description="East longitude bound")
    date_start: Optional[str] = Field(None, description="ISO‑date string, start of the period (inclusive)")
    date_end: Optional[str] = Field(None, description="ISO‑date string, end of the period (inclusive)")
    min_pixel_reliability: Optional[int] = Field(None, ge=0, le=3, description="Quality filter, same as other APIs")
    mann_kendall: Optional[bool] = Field(False, description="If true, also compute Mann‑Kendall test")
