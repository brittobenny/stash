from django.test import SimpleTestCase

from nutrition.services import (
    build_goal_progress,
    build_fix_my_plate_suggestions,
    build_recipe_nutrition_badges,
    build_recipe_nutrition_insights,
)


class NutritionInsightsTests(SimpleTestCase):
    def test_goal_progress_marks_low_and_high_metrics(self):
        progress = build_goal_progress(
            {
                "calories": 2600,
                "protein": 45,
                "carbs": 180,
                "fats": 40,
                "vegetable_servings": 1,
            }
        )
        self.assertEqual(progress["calories"]["status"], "high")
        self.assertEqual(progress["protein"]["status"], "low")
        self.assertEqual(progress["vegetable_servings"]["status"], "low")

    def test_fix_my_plate_returns_actionable_items(self):
        suggestions = build_fix_my_plate_suggestions(
            {
                "calories": 2600,
                "protein": 45,
                "carbs": 320,
                "fats": 95,
                "vegetable_servings": 1,
            }
        )
        titles = {row["title"] for row in suggestions}
        self.assertIn("Boost protein", titles)
        self.assertIn("Add vegetables", titles)

    def test_recipe_badges_detect_high_protein_and_low_calorie(self):
        badges = build_recipe_nutrition_badges(
            {
                "calories": 420,
                "protein": 30,
                "carbs": 45,
                "fats": 16,
                "vegetable_servings": 2.5,
            }
        )
        self.assertIn("High Protein", badges)
        self.assertIn("Low Calorie", badges)
        self.assertIn("Fiber Rich", badges)

    def test_recipe_insights_contains_score_badges_and_suggestions(self):
        insights = build_recipe_nutrition_insights(
            {
                "calories": 420,
                "protein": 30,
                "carbs": 45,
                "fats": 16,
                "vegetable_servings": 2.5,
            }
        )
        self.assertIn("score", insights)
        self.assertIn("badges", insights)
        self.assertIn("fix_my_plate", insights)
        self.assertGreaterEqual(len(insights["badges"]), 1)
