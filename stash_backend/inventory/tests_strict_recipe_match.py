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
        self.assertEqual(result, {"score": 85.71, "status": "COOK_NOW"})
