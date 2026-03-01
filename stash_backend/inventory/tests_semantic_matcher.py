from django.test import SimpleTestCase

from inventory.ml.hero_ingredient_pipeline import compute_strict_recipe_match
from inventory.ml.semantic_matcher import cosine_sim, is_semantic_match


class SemanticMatcherTests(SimpleTestCase):
    def test_cosine_sim_identical_vectors(self):
        score = cosine_sim([1.0, 0.0, 0.0], [1.0, 0.0, 0.0])
        self.assertAlmostEqual(score, 1.0, places=6)

    def test_is_semantic_match_threshold(self):
        self.assertTrue(is_semantic_match([1.0, 0.0], [0.9, 0.1], threshold=0.8))
        self.assertFalse(is_semantic_match([1.0, 0.0], [0.1, 0.9], threshold=0.8))

    def test_strict_match_uses_semantic_embedding_for_hero(self):
        result = compute_strict_recipe_match(
            recipe_ingredients=["chickpea", "salt"],
            recipe_quantities=[100, 2],
            hero_ingredient="chickpea",
            pantry_ingredients=["garbanzo beans", "table salt"],
            pantry_quantities=[120, 4],
            recipe_embedding_lookup={
                "chickpea": [1.0, 0.0, 0.0],
                "salt": [0.0, 1.0, 0.0],
            },
            pantry_embedding_lookup={
                "garbanzo bean": [0.95, 0.05, 0.0],
                "salt": [0.0, 1.0, 0.0],
            },
        )
        self.assertEqual(result, {"score": 100.0, "status": "COOK_NOW"})

    def test_strict_match_fails_when_hero_quantity_is_insufficient(self):
        result = compute_strict_recipe_match(
            recipe_ingredients=["chickpea", "salt"],
            recipe_quantities=[100, 2],
            hero_ingredient="chickpea",
            pantry_ingredients=["garbanzo beans", "table salt"],
            pantry_quantities=[80, 4],
            recipe_embedding_lookup={
                "chickpea": [1.0, 0.0, 0.0],
                "salt": [0.0, 1.0, 0.0],
            },
            pantry_embedding_lookup={
                "garbanzo bean": [0.95, 0.05, 0.0],
                "salt": [0.0, 1.0, 0.0],
            },
        )
        self.assertEqual(result, {"score": 0.0, "status": "INSUFFICIENT_HERO_QUANTITY"})
