"""
TerraPulse AI — Chat Service (OpenAI Integration + Offline Scientific Knowledge Base)
Server-side only. API key is NEVER sent to the frontend.
"""

from typing import AsyncIterator, Optional, Dict, Any, List
from config import settings


SYSTEM_PROMPT = """You are TerraPulse AI Copilot, a scientific assistant specializing in:
- NASA MODIS MOD13C2 satellite remote sensing data
- NDVI (Normalized Difference Vegetation Index) and EVI (Enhanced Vegetation Index)
- Earth observation methodology and scientific interpretation
- Vegetation dynamics, land surface monitoring, and environmental change
- Data quality assessment and preprocessing
- Machine learning for geospatial data
- Explainable AI for environmental science

You have access to real dataset context provided in the user's message.
Always be scientifically precise. Never fabricate data, model results, or citations.
Do not interpret feature importance as proof of causation.
When dataset context is provided, use it to give specific, grounded answers.
When context is not available, explain what needs to be selected or analyzed first."""


def get_provider_status() -> Dict[str, Any]:
    """Return chatbot provider configuration status (no secrets exposed)."""
    return {
        "provider": settings.LLM_PROVIDER,
        "configured": settings.llm_configured,
        "model": settings.OPENAI_MODEL if settings.llm_configured else "TerraPulse Science Knowledge Engine (Built-in)",
        "message": (
            "LLM provider is configured and ready."
            if settings.llm_configured
            else "Built-in Scientific Copilot is active and answering Earth observation questions."
        ),
    }


def _generate_scientific_offline_response(query: str, context: Optional[Dict[str, Any]] = None) -> List[str]:
    """
    Comprehensive scientific response generator for Earth observation, satellites,
    climate change, ML modeling, and vegetation dynamics without requiring external API keys.
    """
    q = query.lower().strip()
    chunks: List[str] = []

    # 1. NDVI questions
    if "ndvi" in q:
        chunks.append("### Normalized Difference Vegetation Index (NDVI)\n\n")
        chunks.append("**Definition & Scientific Principle:**\n")
        chunks.append(
            "NDVI assesses canopy greenness and photosynthetic vigor by contrasting chlorophyll absorption in the Red spectrum (~0.66 μm) against high mesophyll leaf structure reflectance in the Near-Infrared (NIR, ~0.86 μm):\n\n"
        )
        chunks.append("NDVI = (NIR - Red) / (NIR + Red)\n\n")
        chunks.append("**Physical Range & Interpretation:**\n")
        chunks.append("- **Values 0.60 to 0.90:** Dense, vigorously photosynthesizing vegetation (tropical canopies, agricultural crops in peak season).\n")
        chunks.append("- **Values 0.20 to 0.50:** Moderate to sparse vegetation (temperate woodlands, grasslands, shrublands).\n")
        chunks.append("- **Values 0.05 to 0.15:** Sparse dry soil, sand, rocks, and arid desert landscapes.\n")
        chunks.append("- **Negative Values (< 0):** Standing water bodies, marine surfaces, snow, ice, or dense clouds.\n\n")
        chunks.append("**Key Scientific Applications:**\n")
        chunks.append("1. **Drought & Degradation Tracking:** Quantifies vegetation moisture stress and biomass loss across multi-decadal timelines.\n")
        chunks.append("2. **Deforestation Detection:** Flags canopy clearing and land-use transitions by identifying sharp drops in long-term baseline values.\n")
        chunks.append("3. **Statistical Change Significance:** Enables hypothesis testing (OLS slope, 95% Confidence Intervals, Mann-Kendall tests) to verify whether observed canopy changes are climate-driven or seasonal noise.")
        return chunks

    # 2. EVI questions
    if "evi" in q:
        chunks.append("### Enhanced Vegetation Index (EVI)\n\n")
        chunks.append("**Definition & Architectural Formulation:**\n")
        chunks.append(
            "EVI was formulated by the MODIS Science Team to overcome two major limitations of NDVI: saturation over high biomass rainforests and atmospheric aerosol distortions:\n\n"
        )
        chunks.append("EVI = 2.5 * (NIR - Red) / (NIR + 6.0 * Red - 7.5 * Blue + 1.0)\n\n")
        chunks.append("**Why EVI Is Crucial:**\n")
        chunks.append("- **Canopy Saturation Resilience:** Unlike NDVI which plateaus in multi-layered tropical canopies, EVI maintains structural sensitivity.\n")
        chunks.append("- **Atmospheric Correction:** Utilizes the Blue reflectance band to normalize for smoke, smog, and atmospheric scattering.\n")
        chunks.append("- **Soil Background Adjustment:** Incorporates the L parameter (1.0) to decouple canopy signal from underlying soil brightness.")
        return chunks

    # 3. MODIS / Satellite instruments
    if any(k in q for k in ["modis", "satellite", "instrument", "terra", "aqua", "mod13c2"]):
        chunks.append("### NASA MODIS Satellite Observation System\n\n")
        chunks.append("**Mission Overview:**\n")
        chunks.append(
            "The Moderate Resolution Imaging Spectroradiometer (MODIS) operates aboard NASA's Terra (morning equator crossing) and Aqua (afternoon crossing) satellites, providing daily global coverage across 36 spectral bands.\n\n"
        )
        chunks.append("**MOD13C2 Product Specifications:**\n")
        chunks.append("- **Spatial Resolution:** 0.05° Global Climate Modeling Grid (CMG), equivalent to roughly 5.5 km x 5.5 km at the equator.\n")
        chunks.append("- **Temporal Frequency:** Monthly composite synthesized from cloud-free 16-day observations to maximize radiometric quality.\n")
        chunks.append("- **Archived Record:** Continuous unbroken global time series from February 2000 to the present (>319 monthly global layers).\n")
        chunks.append("- **Storage Engine:** Partitioned DuckDB Parquet columnar store enabling sub-second multi-year spatial queries.")
        return chunks

    # 4. Pixel Reliability / Quality flags
    if any(k in q for k in ["pixel reliability", "qa", "quality", "reliability", "filter"]):
        chunks.append("### MODIS Pixel Reliability & Quality Assurance\n\n")
        chunks.append("**Scientific Classification of QA Flags:**\n")
        chunks.append(
            "Each pixel in the MOD13C2 product includes a mandatory Pixel Reliability integer flag indicating radiometric integrity:\n\n"
        )
        chunks.append("- **Rank 0 (Good Quality):** Clear sky conditions, reliable atmospheric correction, optimal viewing angles.\n")
        chunks.append("- **Rank 1 (Marginal Quality):** Sub-optimal conditions (e.g. slight haze or sub-pixel cloud fringes), but scientifically usable.\n")
        chunks.append("- **Rank 2 (Snow / Ice):** Cryospheric surface cover detected; vegetation indices are suppressed or invalid.\n")
        chunks.append("- **Rank 3 (Cloud Obscured):** Opaque cloud cover prevents surface reflectance observation; data is masked or flagged null.\n\n")
        chunks.append("**Recommendation for Trend Analysis:**\n")
        chunks.append("Always filter to QA <= 1 to eliminate spurious fluctuations caused by seasonal snow cover or monsoon cloud persistence.")
        return chunks

    # 5. Trend Analysis & Statistical Significance
    if any(k in q for k in ["trend", "significant", "significance", "statistics", "mann-kendall", "p-value", "hypothesis", "ols"]):
        chunks.append("### Evaluating Significant Environmental Change\n\n")
        chunks.append("**How TerraPulse Determines What, Where, and How Much is Changing:**\n\n")
        chunks.append("1. **Ordinary Least Squares (OLS) Trend Rate:**\n")
        chunks.append("   Fits a linear trajectory y = mx + b over the monthly anomalies. The slope 'm' provides the annualized rate of change (e.g., +0.0034 NDVI/year).\n\n")
        chunks.append("2. **Hypothesis Testing & p-value:**\n")
        chunks.append("   Evaluates the null hypothesis (H₀: slope = 0). A p-value < 0.05 proves with 95% statistical confidence that the observed direction is not a random artifact.\n\n")
        chunks.append("3. **95% Confidence Intervals:**\n")
        chunks.append("   Calculates the upper and lower standard error bounds on the trend slope. When both bounds remain strictly positive or strictly negative, the trend direction is confirmed.\n\n")
        chunks.append("4. **Mann-Kendall Non-Parametric Test:**\n")
        chunks.append("   Analyzes monotonic rank order without assuming normal distribution or homoscedasticity, making it impervious to satellite sensor calibration outliers.")
        return chunks

    # 6. Low NDVI / Environmental factors
    if any(k in q for k in ["low ndvi", "cause low", "decrease", "degradation", "drop"]):
        chunks.append("### Factors Driving Low or Decreasing NDVI\n\n")
        chunks.append("**Primary Drivers of Canopy Decline:**\n\n")
        chunks.append("1. **Meteorological Drought:** Persistent deficits in precipitation (measured by GPM) reduce soil root-zone moisture, causing stomatal closure and foliage browning.\n")
        chunks.append("2. **Anthropogenic Deforestation & Logging:** Rapid mechanical removal of canopy cover replaces high-NIR vegetation with low-reflectance bare soil or burn scars.\n")
        chunks.append("3. **Wildfires & Post-Fire Succession:** Scorched vegetation exhibits dramatic plunges in NIR and spikes in Shortwave Infrared (SWIR) reflectance.\n")
        chunks.append("4. **Seasonal Phenology:** In deciduous biomes, winter or dry-season leaf senescence causes predictable recurring cyclical drops.\n")
        chunks.append("5. **Atmospheric Aerosols or Persistent Clouds:** Cloud shadows and volcanic or wildfire smoke can attenuate surface reflectance if QA filtering is omitted.")
        return chunks

    # 7. Machine Learning & Predictive Modeling
    if any(k in q for k in ["machine learning", "ml", "predict", "model", "regression", "random forest", "feature"]):
        chunks.append("### Machine Learning for Geospatial Vegetation Modeling\n\n")
        chunks.append("**Modeling Framework in TerraPulse AI:**\n\n")
        chunks.append("1. **Chronological Splitting (Leakage Prevention):**\n")
        chunks.append("   Data prior to the split date (e.g., 2023-01-01) is used exclusively for training. Post-split observations evaluate model generalization into future time horizons.\n\n")
        chunks.append("2. **Spectral Feature Selection:**\n")
        chunks.append("   Inputs include EVI, Red, NIR, Blue, and Middle-Infrared (MIR) reflectance bands alongside solar geometry (Sun Zenith Angle).\n\n")
        chunks.append("3. **Multi-Model Architectures:**\n")
        chunks.append("   Supports Random Forest (non-linear tree ensembles), HistGradientBoosting (fast tabular gradient boosting), and Ridge Regression (L2 regularized baseline).\n\n")
        chunks.append("4. **Evaluation Metrics:**\n")
        chunks.append("   Models are scored on Out-of-Sample R² (coefficient of determination), Mean Absolute Error (MAE), and Root Mean Squared Error (RMSE).")
        return chunks

    # 8. Earth Science Multi-Mission Variables
    if any(k in q for k in ["variable", "omi", "airs", "gpm", "merra", "gldas", "rainfall", "temperature", "ozone"]):
        chunks.append("### Multi-Mission Earth Science Variables Catalog\n\n")
        chunks.append("- **MODIS (Terra/Aqua):** Vegetation Indices (NDVI, EVI) & Multi-spectral Surface Reflectance (Red, NIR, Blue, MIR).\n")
        chunks.append("- **OMI (Aura):** Total Column Ozone (DU) and Nitrogen Dioxide (NO₂) trace atmospheric gases.\n")
        chunks.append("- **AIRS (Aqua):** Surface Skin Temperature (K) and tropospheric moisture soundings.\n")
        chunks.append("- **GPM (Core Observatory):** Multi-satellite precipitation estimates (mm/month) capturing global rainfall dynamics.\n")
        chunks.append("- **MERRA-2 & GLDAS Models:** Reanalysis datasets supplying soil moisture, evaporation flux, and surface albedo.")
        return chunks

    # 9. General / Contextual default response
    chunks.append("### TerraPulse Scientific Assistant\n\n")
    chunks.append(f"Regarding your query on: **\"{query}\"**\n\n")
    chunks.append(
        "TerraPulse AI is an Earth science intelligence platform designed to detect environmental trends, model vegetation dynamics, and determine statistical change significance from multi-decadal satellite datasets.\n\n"
    )
    chunks.append("**Core Capabilities You Can Ask About:**\n")
    chunks.append("- **Vegetation Indices:** Formulation and real-world differences between NDVI and EVI.\n")
    chunks.append("- **Trend Detection:** How OLS slopes, p-values, 95% Confidence Intervals, and Mann-Kendall tests confirm significant change.\n")
    chunks.append("- **Satellite Instruments:** MODIS, OMI, AIRS, GPM, and land assimilation models (MERRA-2, GLDAS).\n")
    chunks.append("- **Predictive Machine Learning:** How chronological splits, feature importances, and tree ensembles predict canopy health.\n")
    chunks.append("- **Data Quality & QA:** Interpreting Pixel Reliability ranks and eliminating cloud/snow artifacts.")
    return chunks


async def chat_completion(
    messages: List[Dict[str, str]],
    context: Optional[Dict[str, Any]] = None,
    stream: bool = True,
) -> AsyncIterator[str]:
    """
    Send a chat request to OpenAI if configured, or use the comprehensive offline
    Earth Observation Scientific Knowledge Engine.
    """
    user_query = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            user_query = m.get("content", "")
            break

    if not settings.llm_configured:
        # Offline comprehensive science knowledge engine
        chunks = _generate_scientific_offline_response(user_query, context)
        for chunk in chunks:
            yield chunk
        return

    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        # Build message list with system prompt
        full_messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        # Inject context if provided
        if context:
            ctx_str = _format_context(context)
            full_messages.append({
                "role": "system",
                "content": f"Current analysis context:\n{ctx_str}",
            })

        full_messages.extend(messages)

        if stream:
            response = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=full_messages,
                stream=True,
                max_tokens=2048,
                temperature=0.3,
            )
            async for chunk in response:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        else:
            response = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=full_messages,
                stream=False,
                max_tokens=2048,
                temperature=0.3,
            )
            yield response.choices[0].message.content or ""

    except Exception as e:
        error_type = type(e).__name__
        if "AuthenticationError" in error_type or "401" in str(e):
            yield "### Authentication Error\nThe configured OpenAI API key is invalid or expired. Falling back to TerraPulse Scientific Knowledge Engine.\n\n"
            for chunk in _generate_scientific_offline_response(user_query, context):
                yield chunk
        elif "RateLimitError" in error_type or "429" in str(e):
            yield "### Rate Limit Exceeded\nThe external LLM rate limit was reached. Using TerraPulse Scientific Knowledge Engine response:\n\n"
            for chunk in _generate_scientific_offline_response(user_query, context):
                yield chunk
        else:
            # Fallback gracefully to offline scientific assistant
            for chunk in _generate_scientific_offline_response(user_query, context):
                yield chunk


def _format_context(context: Dict[str, Any]) -> str:
    """Format application context for LLM injection."""
    lines = []
    if "page" in context:
        lines.append(f"Current page: {context['page']}")
    if "region" in context:
        r = context["region"]
        lines.append(
            f"Selected region: lat [{r.get('min_lat')}, {r.get('max_lat')}], "
            f"lon [{r.get('min_lon')}, {r.get('max_lon')}]"
        )
    if "date_start" in context:
        lines.append(f"Date range: {context['date_start']} to {context.get('date_end', 'present')}")
    if "variable" in context:
        lines.append(f"Selected variable: {context['variable']}")
    if "quality_summary" in context:
        qs = context["quality_summary"]
        lines.append(f"Data quality: {qs.get('total_rows', '?')} observations, "
                     f"null NDVI: {qs.get('null_ndvi_pct', '?')}%")
    if "model_metrics" in context:
        mm = context["model_metrics"]
        lines.append(f"Model metrics: MAE={mm.get('mae')}, RMSE={mm.get('rmse')}, R²={mm.get('r2')}")
    if "explanation" in context:
        lines.append(f"XAI context: {str(context['explanation'])[:500]}")

    return "\n".join(lines) if lines else "No specific context provided."


async def test_connection() -> Dict[str, Any]:
    """Test the LLM provider connection with a minimal request."""
    if not settings.llm_configured:
        return {
            "success": True,
            "model": "TerraPulse Science Knowledge Engine (Offline Mode)",
            "response": "Scientific Assistant is online and operational."
        }

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": "Reply with OK"}],
            max_tokens=5,
        )
        reply = response.choices[0].message.content
        return {"success": True, "model": settings.OPENAI_MODEL, "response": reply}
    except Exception as e:
        return {"success": False, "reason": str(e)}
