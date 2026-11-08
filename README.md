# TerraPulse AI — NASA Earth Change Explorer

AI-powered Earth science observation and statistical trend analysis platform built on NASA satellite missions (**MODIS, OMI, AIRS, GPM**) and Earth system models (**MERRA-2, GLDAS**), featuring high-performance local Parquet DuckDB processing (319 monthly composites) and interactive multi-mission exploration.

---

## Challenge Solution Overview: Earth Change Explorer

Changes in Earth's interconnected environmental system often run in a consistent direction over time—rising or falling, thickening or thinning. A measured variable can trend one way in one region and the opposite way in another even when driven by the same global process.

The **Earth Change Explorer** provides a unified tool designed for students, researchers, and data detectives to:
1. **Discover & Select Earth Science Variables**: Browse categorized satellite instruments (MODIS vegetation/reflectance, OMI ozone/NO₂, AIRS atmospheric temperature/water vapor, GPM precipitation) and global models (MERRA-2 reanalysis temperature/aerosols, GLDAS root zone soil moisture/evapotranspiration) with accessible, student-friendly definitions.
2. **Region & Bounding Box Sub-selection**: Query precise geographical bounding boxes or load 1-click curated demonstration scenarios across the globe (e.g. Amazon Rainforest, California Central Valley, Arctic Polar Warming, Sahara Dust Belt, Antarctic Ozone Shield, Ganges Monsoon Basin).
3. **Time Series Extraction & Visualization**: Spatially aggregate grid observations and render interactive monthly time series with fitted linear regression trendlines and confidence metrics.
4. **Determine Statistical Significance**:
   - **Rate of Change**: Calculates slope per month and annualized rate of change per year with physical units.
   - **Hypothesis Testing**: Ordinary Least Squares (OLS) Student's *t*-test *p*-value at customizable significance thresholds (α = 0.01, 0.05, 0.10).
   - **Confidence Intervals**: 95% confidence intervals on the rate of change.
   - **Monotonic Trend Testing**: Non-parametric Mann-Kendall test reporting trend direction (*increasing*, *decreasing*, *no trend*), Kendall's Tau, and *p*-value.
   - **Data Detective Summary**: Answers **What** is changing, **Where** it is changing, **How much** it is changing, and **If the change is significant** in clear plain English.
5. **Scientific Export**:
   - **Annotated CSV**: Formatted with full metadata headers, summary statistics, and time series data named `<variable>_<date_start>_to_<date_end>.csv`.
   - **High-Resolution PNG**: 1-click client-side chart image export.

---

## Quick Start (Any System)

### Requirements
- Python 3.11 or higher
- Optional: Node.js (only if modifying frontend code; the frontend is already pre-built into `frontend/dist`)

### Setup & Launch

```bash
# 1. Install Python dependencies
cd backend
pip install -r requirements.txt

# 2. Launch the application (from project root)
# Windows: Double-click start.bat
start.bat

# OR launch via command line:
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000

# 3. Open your browser:
http://localhost:8000/
```

### Default Login Credentials
- **Admin**: `admin@terrapulse.local`
- **Password**: `TerraPulse@Admin2024`
- Regular users can also sign up directly via the `/register` page.

---

## Supported Earth Science Missions & Models

| Mission / Model | Variable Key | Name | Category | Physical Units |
|---|---|---|---|---|
| **MODIS (Terra/Aqua)** | `NDVI` | Normalized Difference Vegetation Index | Biosphere | unitless (-0.2 to 1.0) |
| **MODIS (Terra/Aqua)** | `EVI` | Enhanced Vegetation Index | Biosphere | unitless (-0.2 to 1.0) |
| **MODIS (Terra/Aqua)** | `Red_Reflectance` | Band 1 Red Surface Reflectance | Land Optics | reflectance (0.0 to 1.6) |
| **MODIS (Terra/Aqua)** | `NIR_Reflectance` | Band 2 Near-Infrared Reflectance | Land Optics | reflectance (0.0 to 1.6) |
| **MODIS (Terra/Aqua)** | `Blue_Reflectance`| Band 3 Blue Surface Reflectance | Land Optics | reflectance (0.0 to 1.6) |
| **MODIS (Terra/Aqua)** | `MIR_Reflectance` | Band 7 Mid-Infrared Reflectance | Land Optics | reflectance (0.0 to 1.6) |
| **OMI (Aura)** | `OMI_O3` | Total Column Ozone | Atmosphere | Dobson Units (DU) |
| **OMI (Aura)** | `OMI_NO2` | Tropospheric Nitrogen Dioxide | Air Quality | 10¹⁵ molec/cm² |
| **AIRS (Aqua)** | `AIRS_AirTemp` | Surface Air Temperature | Climate | °C |
| **AIRS (Aqua)** | `AIRS_WaterVapor`| Total Precipitable Water Vapor | Hydrology | mm |
| **GPM IMERG** | `GPM_Precipitation` | Monthly Precipitation Rate | Hydrology | mm/month |
| **MERRA-2** | `MERRA2_T2M` | Surface 2-Meter Temperature | Reanalysis Model | °C |
| **MERRA-2** | `MERRA2_AOD` | Aerosol Optical Depth (550nm) | Model Aerosols | optical depth (0–2.5) |
| **GLDAS Noah** | `GLDAS_SoilMois` | Root Zone Soil Moisture (0-100cm) | Land Model | kg/m² |
| **GLDAS Noah** | `GLDAS_Evap` | Total Evapotranspiration Flux | Land Model | kg/m²/month |

---

## Data Configuration

The platform supports both high-resolution local Parquet files (DuckDB query engine) and multi-mission satellite data feeds:

```ini
# backend/.env
PARQUET_DIR=D:\MODIS\MOD13C2_Parquet    # 319 monthly files (Feb 2000 – present)
DERIVED_DIR=D:\MODIS\Derived
DATABASE_URL=sqlite:///./terrapulse.db
```

---

## Automated Verification & Testing

To execute all unit tests across the service layer and explorer API endpoints:

```bash
# Run all unit tests
python -m unittest discover -s backend/tests -v
```

All 12 tests verify:
- Variable catalog completeness across missions & models.
- Linear regression slope, intercept, t-statistic, *p*-value, and 95% confidence intervals.
- Non-parametric Mann-Kendall monotonic trend tests.
- MODIS local parquet extraction & temporal file pruning.
- Multi-mission time series synthesis and data detective verdicts.
- Annotated CSV output format with `<variable>_<start>_to_<end>.csv` naming conventions.
- Direct endpoint execution for grid, time series, analysis, and export.

---

## License & Credits
Developed for the NASA International Space Apps Challenge / Earth Science Data Exploration initiative.
Data courtesy of NASA Earth Science Data and Information System (ESDIS), LP DAAC, GES DISC, and GMAO.
