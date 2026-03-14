from django.test import SimpleTestCase

from inventory.ml.hero_ingredient_pipeline import compute_strict_recipe_match, normalize


class ComputeStrictRecipeMatchTests(SimpleTestCase):
    def test_normalize_uses_canonical_mapping(self):
        self.assertEqual(normalize("  Chicken Breast "), "chicken")
        self.assertEqual(normalize("table salt"), "salt")
        self.assertEqual(normalize("dahi"), "yogurt")

    def test_returns_needs_key_ingredient_when_hero_absent(self):
        result = compute_strict_recipe_match(
            recipe_ingredients=["chicken", "salt", "oil"],
            recipe_quantities=[500, 2, 5],
            hero_ingredient="chicken",
            pantry_ingredients=["salt", "oil"],
            pantry_quantities=[10, 20],
        )
        self.assertEqual(result, {"score": 0.0, "status": "NEEDS_KEY_INGREDIENT"})

    def test_returns_insufficient_hero_quantity_when_hero_is_low(self):
        result = compute_strict_recipe_match(
            recipe_ingredients=["chicken", "salt", "oil"],
            recipe_quantities=[500, 2, 5],
            hero_ingredient="chicken",
            pantry_ingredients=["chicken breast", "salt", "oil"],
            pantry_quantities=[200, 10, 5],
        )
        self.assertEqual(result, {"score": 0.0, "status": "INSUFFICIENT_HERO_QUANTITY"})

    def test_quantity_weighted_result_for_prompt_example(self):
        result = compute_strict_recipe_match(
            recipe_ingredients=["chicken", "salt", "oil"],
            recipe_quantities=[500, 2, 5],
            hero_ingredient="chicken",
            pantry_ingredients=["chicken breast", "salt"],
            pantry_quantities=[500, 10],
        )
        self.assertEqual(result, {"score": 83.33, "status": "COOK_NOW"})

    def test_multi_hero_requires_all_key_ingredients(self):
        result = compute_strict_recipe_match(
            recipe_ingredients=["chicken", "rice", "salt", "oil"],
            recipe_quantities=[300, 250, 5, 10],
            hero_ingredient=["chicken", "rice"],
            pantry_ingredients=["chicken breast", "salt", "oil"],
            pantry_quantities=[300, 10, 20],
        )
        self.assertEqual(result, {"score": 0.0, "status": "NEEDS_KEY_INGREDIENT"})

    def test_multi_hero_passes_when_all_heroes_are_present(self):
        result = compute_strict_recipe_match(
            recipe_ingredients=["chicken", "rice", "salt", "oil"],
            recipe_quantities=[300, 250, 5, 10],
            hero_ingredient=["chicken", "rice"],
            pantry_ingredients=["chicken breast", "basmati rice", "salt"],
            pantry_quantities=[300, 300, 10],
        )
        self.assertEqual(result, {"score": 90.91, "status": "COOK_NOW"})

    def test_basic_spices_are_not_returned_as_missing(self):
        result = compute_strict_recipe_match(
            recipe_ingredients=["chicken", "salt", "turmeric powder"],
            recipe_quantities=[300, 5, 2],
            hero_ingredient="chicken",
            pantry_ingredients=["chicken breast"],
            pantry_quantities=[300],
            return_details=True,
        )
        self.assertEqual(result["score"], 100.0)
        self.assertEqual(result["status"], "COOK_NOW")
        self.assertEqual(result["missing_ingredients"], [])
