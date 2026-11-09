"""
Tests for Explainability Service
"""

import sys
import unittest
from pathlib import Path

# Add backend to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.explainability_service import (
    compute_global_explanation,
    compute_partial_dependence,
    compute_local_explanation,
)
from services.ml_service import ARTIFACTS_DIR


class TestXAIService(unittest.TestCase):
    def setUp(self):
        artifacts = list(ARTIFACTS_DIR.glob("*.pkl"))
        if not artifacts:
            self.skipTest("No model artifacts found for testing XAI")
        self.artifact_path = str(artifacts[0])

    def test_global_explanation_returns_importance_and_info(self):
        result = compute_global_explanation(self.artifact_path, X_sample=None)
        self.assertIn("native_importance", result)
        self.assertIsNotNone(result["native_importance"])
        self.assertIn("model_info", result)
        self.assertIsNotNone(result["model_info"])
        self.assertIn("algorithm", result["model_info"])

    def test_partial_dependence_runs_without_sample(self):
        result = compute_global_explanation(self.artifact_path, X_sample=None)
        features = result["features"]
        if not features:
            self.skipTest("No features in model")
        feat = features[0]
        pdp = compute_partial_dependence(self.artifact_path, feat, X_sample=None)
        self.assertEqual(pdp["feature"], feat)
        self.assertEqual(len(pdp["grid"]), 50)
        self.assertEqual(len(pdp["pdp"]), 50)

    def test_local_explanation_runs_with_case_insensitive_features(self):
        result = compute_global_explanation(self.artifact_path, X_sample=None)
        features = result["features"]
        if not features:
            self.skipTest("No features in model")
        # Pass features in uppercase
        upper_vals = {f.upper(): 0.35 for f in features}
        explanation = compute_local_explanation(self.artifact_path, upper_vals)
        self.assertIn("prediction", explanation)
        self.assertIsNotNone(explanation["prediction"])
        self.assertIn("feature_contributions", explanation)
