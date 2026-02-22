from django.db import models
from django.conf import settings
from django.utils import timezone

class NutritionItem(models.Model):
    name = models.CharField(max_length=255, unique=True)

    calories = models.FloatField()
    carbs = models.FloatField()
    protein = models.FloatField()
    fats = models.FloatField()
    fiber = models.FloatField(null=True, blank=True)

    def __str__(self):
        return self.name


class CookedRecipeLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cooked_recipe_logs")
    recipe_id = models.IntegerField(null=True, blank=True)
    recipe_name = models.CharField(max_length=255)
    cooked_at = models.DateTimeField(default=timezone.now, db_index=True)

    calories = models.FloatField(default=0)
    protein = models.FloatField(default=0)
    carbs = models.FloatField(default=0)
    fats = models.FloatField(default=0)
    vegetable_servings = models.FloatField(default=0)

    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "cooked_at"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.recipe_name} @ {self.cooked_at}"


class DailyNutritionScore(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="daily_nutrition_scores")
    date = models.DateField(db_index=True)

    total_calories = models.FloatField(default=0)
    total_protein = models.FloatField(default=0)
    total_carbs = models.FloatField(default=0)
    total_fats = models.FloatField(default=0)
    total_vegetable_servings = models.FloatField(default=0)

    score = models.PositiveSmallIntegerField(default=0)
    balanced = models.BooleanField(default=False)
    breakdown = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "date")
        indexes = [
            models.Index(fields=["user", "date"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.date} ({self.score})"


class WeeklyNutritionScore(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="weekly_nutrition_scores")
    week_start = models.DateField(db_index=True)
    week_end = models.DateField()

    average_score = models.FloatField(default=0)
    days_tracked = models.PositiveSmallIntegerField(default=0)
    balanced_days = models.PositiveSmallIntegerField(default=0)

    total_calories = models.FloatField(default=0)
    total_protein = models.FloatField(default=0)
    total_carbs = models.FloatField(default=0)
    total_fats = models.FloatField(default=0)
    total_vegetable_servings = models.FloatField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "week_start")
        indexes = [
            models.Index(fields=["user", "week_start"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.week_start} ({self.average_score})"


class NutritionGamificationProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="nutrition_gamification")
    points = models.PositiveIntegerField(default=0)
    level = models.PositiveIntegerField(default=1)
    current_streak = models.PositiveIntegerField(default=0)
    longest_streak = models.PositiveIntegerField(default=0)
    healthy_week_badges = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user} - L{self.level} ({self.points} pts)"


class NutritionRewardEvent(models.Model):
    EVENT_COOK_LOG = "cook_log"
    EVENT_DAILY_BALANCE = "daily_balance"
    EVENT_STREAK_BONUS = "streak_bonus"
    EVENT_HEALTHY_WEEK_BADGE = "healthy_week_badge"
    EVENT_LEVEL_UP = "level_up"

    EVENT_CHOICES = [
        (EVENT_COOK_LOG, "Cook Log"),
        (EVENT_DAILY_BALANCE, "Daily Balance"),
        (EVENT_STREAK_BONUS, "Streak Bonus"),
        (EVENT_HEALTHY_WEEK_BADGE, "Healthy Week Badge"),
        (EVENT_LEVEL_UP, "Level Up"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="nutrition_rewards")
    event_type = models.CharField(max_length=40, choices=EVENT_CHOICES)
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    points = models.IntegerField(default=0)
    reference_date = models.DateField(null=True, blank=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    awarded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "awarded_at"]),
            models.Index(fields=["user", "event_type", "reference_date"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.event_type} ({self.points})"
