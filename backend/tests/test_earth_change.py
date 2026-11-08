"""
Unit tests for Earth Change Explorer Service and APIs using standard unittest.
Verifies multi-mission variable catalog, statistical regression,
significance tests, and CSV document generation.
"""

import sys
import unittest
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from services.earth_change_service import (
    list_variables,
    linear_trend,
    mann_kendall_trend,
    analyze,
    generate_csv,
    MISSION_VARIABLES,
)
from services.data_source import LocalParquetSource, ExternalAPISource


class TestEarthChangeService(unittest.TestCase):

    def test_list_variables(self):
        vars_list = list_variables()
        self.assertGreaterEqual(len(vars_list), 10)
        var_ids = [v["id"] for v in vars_list]
        self.assertIn("NDVI", var_ids)
        self.assertIn("EVI", var_ids)
        self.assertIn("AIRS_AirTemp", var_ids)
        self.assertIn("OMI_O3", var_ids)
        self.assertIn("GPM_Precipitation", var_ids)
        self.assertIn("MERRA2_AOD", var_ids)
        self.assertIn("GLDAS_SoilMois", var_ids)

    def test_linear_trend_synthetic(self):
        # Linear series with known slope 0.5 per month
        x = list(range(24))
        y = [10.0 + 0.5 * i for i in x]
        res = linear_trend(y)

        self.assertNotIn("error", res)
        self.assertAlmostEqual(res["slope"], 0.5, places=3)
        self.assertAlmostEqual(res["slope_per_year"], 6.0, places=3)
        self.assertAlmostEqual(res["intercept"], 10.0, places=3)
        self.assertAlmostEqual(res["r_squared"], 1.0, places=3)
        self.assertLess(res["p_value"], 0.0001)
        self.assertTrue(res["t_statistic"] > 50.0 or res["t_statistic"] == float('inf'))
        ci = res["confidence_interval_95"]
        self.assertTrue(ci[0] <= 0.5 <= ci[1])

    def test_mann_kendall_trend(self):
        y = [1.0, 1.5, 2.0, 2.8, 3.2, 4.0, 4.7, 5.5]
        res = mann_kendall_trend(y)
        self.assertEqual(res["trend"], "increasing")
        self.assertLess(res["p_value"], 0.05)

    def test_analyze_modis_local(self):
        region = {"min_lat": -5.0, "max_lat": 5.0, "min_lon": -65.0, "max_lon": -55.0}
        res = analyze(
            variable="NDVI",
            date_start="2015-01-01",
            date_end="2018-12-01",
            region=region,
            min_pixel_reliability=1,
            significance_alpha=0.05,
            use_mann_kendall=True,
        )
        self.assertNotIn("error", res)
        self.assertIn("time_series", res)
        self.assertGreater(len(res["time_series"]), 0)
        stats_data = res["statistics"]
        self.assertIn("linear", stats_data)
        self.assertIn("slope_per_year", stats_data["linear"])
        self.assertIn("significance", stats_data)
        self.assertIn("detective_summary", res)
        self.assertIn("what", res["detective_summary"])
        self.assertIn("how_much", res["detective_summary"])

    def test_analyze_external_mission(self):
        region = {"min_lat": 30.0, "max_lat": 40.0, "min_lon": -120.0, "max_lon": -110.0}
        res = analyze(
            variable="AIRS_AirTemp",
            date_start="2010-01-01",
            date_end="2020-01-01",
            region=region,
            significance_alpha=0.05,
            use_mann_kendall=True,
            source="external",
        )
        self.assertNotIn("error", res)
        self.assertGreater(len(res["time_series"]), 0)
        self.assertEqual(res["variable_meta"]["mission"], "AIRS (Aqua Satellite)")

    def test_generate_csv(self):
        region = {"min_lat": 0.0, "max_lat": 10.0, "min_lon": 10.0, "max_lon": 20.0}
        res = analyze(
            variable="NDVI",
            date_start="2020-01-01",
            date_end="2021-12-01",
            region=region,
            use_mann_kendall=True,
        )
        csv_str = generate_csv(res)
        self.assertIn("# NASA Earth Change Explorer — Analysis Export", csv_str)
        self.assertIn("NDVI", csv_str)
        self.assertIn("Rate of Change (per year)", csv_str)
        self.assertIn("p-value (Linear Regression)", csv_str)
        self.assertIn("date,observed_mean,trendline_fitted", csv_str)


if __name__ == "__main__":
    unittest.main()
