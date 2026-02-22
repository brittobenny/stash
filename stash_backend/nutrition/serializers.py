from rest_framework import serializers

from .models import (
    DailyNutritionScore,
    WeeklyNutritionScore,
    NutritionGamificationProfile,
    NutritionRewardEvent,
    CookedRecipeLog,
)


class CookedRecipeLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = CookedRecipeLog
        fields = [
            "id",
            "recipe_id",
            "recipe_name",
            "cooked_at",
            "calories",
            "protein",
            "carbs",
            "fats",
            "vegetable_servings",
            "metadata",
        ]


class DailyNutritionScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyNutritionScore
        fields = [
            "date",
            "total_calories",
            "total_protein",
            "total_carbs",
            "total_fats",
            "total_vegetable_servings",
            "score",
            "balanced",
            "breakdown",
        ]


class WeeklyNutritionScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyNutritionScore
        fields = [
            "week_start",
            "week_end",
            "average_score",
            "days_tracked",
            "balanced_days",
            "total_calories",
            "total_protein",
            "total_carbs",
            "total_fats",
            "total_vegetable_servings",
        ]


class NutritionGamificationProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionGamificationProfile
        fields = [
            "points",
            "level",
            "current_streak",
            "longest_streak",
            "healthy_week_badges",
            "updated_at",
        ]


class NutritionRewardEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionRewardEvent
        fields = [
            "id",
            "event_type",
            "title",
            "description",
            "points",
            "reference_date",
            "metadata",
            "awarded_at",
        ]
