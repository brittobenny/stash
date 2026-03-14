from django.test import SimpleTestCase

from inventory.ml.hero_ingredient_pipeline import compute_recipe_match


class ComputeRecipeMatchTests(SimpleTestCase):
    def test_hero_missing_applies_strong_penalty(self):
        user_pantry = ["onion", "chicken breast", "salt", "tomato"]
        recipe_ingredients = ["chicken breast", "peanut butter", "onion", "salt"]
        quantities = [300, 120, 80, 5]
        hero_ingredient = "peanut butter"

        score = compute_recipe_match(
            recipe_ingredients=recipe_ingredients,
            quantities=quantities,
            hero_ingredient=hero_ingredient,
            user_pantry=user_pantry,
        )

        # Common spices are ignored, so denominator is smaller; still strongly penalized.
        self.assertEqual(score, 22.22)
        self.assertLess(score, 75.0)

    def test_strict_mode_returns_zero_when_hero_missing(self):
        score = compute_recipe_match(
            recipe_ingredients=["chicken breast", "peanut butter", "onion", "salt"],
            quantities=[300, 120, 80, 5],
            hero_ingredient="peanut butter",
            user_pantry=["onion", "chicken breast", "salt", "tomato"],
            strict_mode=True,
        )
        self.assertEqual(score, 0.0)

    def test_table_salt_is_normalized_as_salt(self):
        score = compute_recipe_match(
            recipe_ingredients=["salt", "onion"],
            quantities=[5, 50],
            hero_ingredient="onion",
            user_pantry=["table salt", "onion"],
        )
        self.assertEqual(score, 100.0)

    def test_multi_hero_penalizes_partial_key_coverage(self):
        score = compute_recipe_match(
            recipe_ingredients=["chicken", "rice", "salt", "oil"],
            quantities=[300, 250, 5, 10],
            hero_ingredient=["chicken", "rice"],
            user_pantry=["chicken", "salt", "oil"],
        )
        self.assertEqual(score, 27.27)

    def test_basic_spices_are_ignored_in_weighted_score(self):
        score = compute_recipe_match(
            recipe_ingredients=["chicken", "salt", "turmeric powder"],
            quantities=[300, 5, 2],
            hero_ingredient="chicken",
            user_pantry=["chicken"],
        )
        self.assertEqual(score, 100.0)
