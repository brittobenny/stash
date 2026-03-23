from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from nutrition.models import CookedRecipeLog, DailyNutritionScore
from nutrition.services import recompute_daily_score, build_weekly_trend_payload


class DailyMealQualityScoreTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="nutrition-test-user",
            password="testpass123",
        )
        self.day = timezone.localdate()

    def test_balanced_meals_score_higher_than_junk_heavy_meals(self):
        CookedRecipeLog.objects.create(
            user=self.user,
            recipe_name="Veg Omelette",
            cooked_at=timezone.now(),
            calories=420,
            protein=26,
            carbs=24,
            fats=18,
            vegetable_servings=1.5,
        )
        CookedRecipeLog.objects.create(
            user=self.user,
            recipe_name="Paneer Salad Bowl",
            cooked_at=timezone.now(),
            calories=510,
            protein=28,
            carbs=32,
            fats=20,
            vegetable_servings=2.0,
        )

        balanced_day = recompute_daily_score(self.user, self.day)
        self.assertGreaterEqual(balanced_day.score, 75)
        self.assertTrue(balanced_day.balanced)

        CookedRecipeLog.objects.all().delete()

        CookedRecipeLog.objects.create(
            user=self.user,
            recipe_name="Loaded Fries",
            cooked_at=timezone.now(),
            calories=920,
            protein=8,
            carbs=110,
            fats=42,
            vegetable_servings=0.1,
        )
        CookedRecipeLog.objects.create(
            user=self.user,
            recipe_name="Cheesy Garlic Bread",
            cooked_at=timezone.now(),
            calories=780,
            protein=10,
            carbs=96,
            fats=34,
            vegetable_servings=0.0,
        )

        junk_day = recompute_daily_score(self.user, self.day)
        self.assertLess(junk_day.score, balanced_day.score)
        self.assertFalse(junk_day.balanced)
        self.assertLess(junk_day.score, 40)


class WeeklyTrendPayloadTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="nutrition-trend-user",
            password="testpass123",
        )
        self.end_day = timezone.localdate()

    def test_weekly_trend_includes_full_window_and_marks_untracked_days(self):
        first_day = self.end_day - timedelta(days=6)
        DailyNutritionScore.objects.create(user=self.user, date=first_day, score=52)
        DailyNutritionScore.objects.create(user=self.user, date=self.end_day, score=78)

        payload = build_weekly_trend_payload(self.user, end_day=self.end_day, days=7)

        self.assertEqual(len(payload["points"]), 7)
        self.assertEqual(payload["tracked_days"], 2)
        self.assertEqual(payload["delta"], 26)
        self.assertEqual(payload["direction"], "up")
        self.assertTrue(payload["points"][0]["tracked"])
        self.assertFalse(payload["points"][1]["tracked"])
        self.assertTrue(payload["points"][-1]["tracked"])

    def test_weekly_trend_stays_flat_with_single_tracked_day(self):
        DailyNutritionScore.objects.create(user=self.user, date=self.end_day, score=81)

        payload = build_weekly_trend_payload(self.user, end_day=self.end_day, days=7)

        self.assertEqual(len(payload["points"]), 7)
        self.assertEqual(payload["tracked_days"], 1)
        self.assertEqual(payload["delta"], 0)
        self.assertEqual(payload["direction"], "flat")
