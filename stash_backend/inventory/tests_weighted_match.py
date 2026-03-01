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

        # Naive score is 75% (3/4), weighted score drops to 25% due to missing hero.
        self.assertEqual(score, 25.0)
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
