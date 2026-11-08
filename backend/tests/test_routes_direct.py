"""
Direct route function tests without ASGITransport overhead.
"""

import sys
import unittest
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from api.explorer_routes import (
    get_variables,
    get_grid,
    get_timeseries,
    run_analysis,
    export_csv,
)
from models.earth_change_request import EarthChangeRequest
from database import User, UserRole


class TestExplorerRoutesDirect(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.user = User(
            id=1,
            username="admin",
            email="admin@terrapulse.local",
            role=UserRole.ADMIN,
            is_active=True,
        )

    def test_get_variables(self):
        vars_list = get_variables(current_user=self.user)
        self.assertGreaterEqual(len(vars_list), 10)
        ids = [v["id"] for v in vars_list]
        self.assertIn("NDVI", ids)
        self.assertIn("AIRS_AirTemp", ids)

    def test_get_grid(self):
        res = get_grid(
            variable="NDVI",
            resolution=2.0,
            min_lat=-10,
            max_lat=10,
            min_lon=-60,
            max_lon=-40,
            date_start="2015-01-01",
            date_end="2015-06-01",
            min_pixel_reliability=1,
            source="local",
            current_user=self.user,
        )
        self.assertIn("grid", res)
        self.assertGreater(res["cell_count"], 0)

    def test_get_timeseries(self):
        res = get_timeseries(
            variable="NDVI",
            min_lat=-5,
            max_lat=5,
            min_lon=-65,
            max_lon=-55,
            date_start="2015-01-01",
            date_end="2016-06-01",
            min_pixel_reliability=1,
            source="local",
            current_user=self.user,
        )
        self.assertIn("series", res)
        self.assertGreater(len(res["series"]), 0)

    def test_run_analysis_local(self):
        req = EarthChangeRequest(
            variable="NDVI",
            min_lat=-5,
            max_lat=5,
            min_lon=-65,
            max_lon=-55,
            date_start="2015-01-01",
            date_end="2016-12-01",
            min_pixel_reliability=1,
            significance_alpha=0.05,
            mann_kendall=True,
        )
        res = run_analysis(req, source="local", current_user=self.user)
        self.assertIn("statistics", res)
        self.assertIn("detective_summary", res)
        self.assertIn("slope_per_year", res["statistics"]["linear"])

    def test_run_analysis_external(self):
        req = EarthChangeRequest(
            variable="AIRS_AirTemp",
            min_lat=30,
            max_lat=40,
            min_lon=-120,
            max_lon=-110,
            date_start="2010-01-01",
            date_end="2020-01-01",
            significance_alpha=0.05,
            mann_kendall=True,
        )
        res = run_analysis(req, source="external", current_user=self.user)
        self.assertIn("statistics", res)
        self.assertIn("detective_summary", res)

    def test_export_csv(self):
        res = export_csv(
            variable="NDVI",
            min_lat=-5,
            max_lat=5,
            min_lon=-65,
            max_lon=-55,
            date_start="2015-01-01",
            date_end="2016-12-01",
            min_pixel_reliability=1,
            significance_alpha=0.05,
            mann_kendall=True,
            source="local",
            current_user=self.user,
        )
        self.assertIn("csv", res)
        self.assertEqual(res["filename"], "NDVI_2015-01-01_to_2016-12-01.csv")


if __name__ == "__main__":
    unittest.main()
