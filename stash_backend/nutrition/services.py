from datetime import timedelta

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from inventory.models import Ingredient
from .models import (
    CookedRecipeLog,
    DailyNutritionScore,
    WeeklyNutritionScore,
    NutritionGamificationProfile,
    NutritionRewardEvent,
)


# Reasonable broad healthy ranges for adult daily intake.
DAILY_RANGES = {
    "calories": (1600.0, 2600.0),
    "protein": (60.0, 160.0),
    "carbs": (180.0, 325.0),
    "fats": (44.0, 90.0),
    "vegetable_servings": (3.0, 7.0),
}

METRIC_WEIGHTS = {
    "calories": 22.0,
    "protein": 23.0,
    "carbs": 20.0,
    "fats": 20.0,
    "vegetable_servings": 15.0,
}

PENALTIES = {
    "calories": {"low": 1.0, "high": 1.0},
    "protein": {"low": 1.4, "high": 0.6},
    "carbs": {"low": 0.6, "high": 1.2},
    "fats": {"low": 0.7, "high": 1.3},
    "vegetable_servings": {"low": 1.6, "high": 0.2},
}

VEGETABLE_KEYWORDS = {
    "onion", "tomato", "potato", "carrot", "cabbage", "spinach", "lettuce",
    "broccoli", "cauliflower", "capsicum", "pepper", "beans", "peas",
    "cucumber", "pumpkin", "gourd", "zucchini", "okra", "brinjal", "eggplant",
    "radish", "beetroot", "garlic", "ginger", "chilli", "chili", "celery",
}

STREAK_MILESTONES = (3, 7, 14, 30)


def _to_float(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _normalize_name(name: str) -> str:
    return " ".join(str(name or "").strip().lower().split())


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _metric_ratio(value: float, low: float, high: float, low_penalty: float, high_penalty: float):
    if low <= value <= high:
        return 1.0, True
    if value < low:
        ratio = 1.0 - low_penalty * ((low - value) / max(low, 1.0))
        return _clamp(ratio, 0.0, 1.0), False
    ratio = 1.0 - high_penalty * ((value - high) / max(high, 1.0))
    return _clamp(ratio, 0.0, 1.0), False


def _estimate_vegetable_servings(parsed_ingredients) -> float:
    if not isinstance(parsed_ingredients, list):
        return 0.0

    known_vegetables = set(
        Ingredient.objects.filter(category="Vegetable")
        .values_list("name", flat=True)
    )
    known_vegetables = {_normalize_name(n) for n in known_vegetables}

    total_veg_grams = 0.0
    for item in parsed_ingredients:
        if not isinstance(item, dict):
            continue
        name = _normalize_name(item.get("name"))
        grams = _to_float(item.get("grams"))
        if not name or grams <= 0:
            continue

        is_known_veg = name in known_vegetables
        is_keyword_veg = any(k in name for k in VEGETABLE_KEYWORDS)
        if is_known_veg or is_keyword_veg:
            total_veg_grams += grams

    # 1 serving ~ 80g.
    return round(total_veg_grams / 80.0, 2)


def _compute_daily_score(totals: dict):
    breakdown = {}
    score = 0.0
    in_range_count = 0

    for metric, weight in METRIC_WEIGHTS.items():
        low, high = DAILY_RANGES[metric]
        ratio, in_range = _metric_ratio(
            _to_float(totals.get(metric)),
            low,
            high,
            PENALTIES[metric]["low"],
            PENALTIES[metric]["high"],
        )
        metric_points = weight * ratio
        score += metric_points
        in_range_count += int(in_range)
        breakdown[metric] = {
            "value": round(_to_float(totals.get(metric)), 2),
            "range": {"min": low, "max": high},
            "in_range": in_range,
            "points": round(metric_points, 2),
        }

    # Balance bonus if most nutrients are within range.
    if in_range_count >= 4:
        score += 5.0

    # Extra hard penalties for problematic patterns.
    carbs_high = _to_float(totals.get("carbs")) > DAILY_RANGES["carbs"][1] * 1.2
    fats_high = _to_float(totals.get("fats")) > DAILY_RANGES["fats"][1] * 1.2
    protein_low = _to_float(totals.get("protein")) < DAILY_RANGES["protein"][0] * 0.8
    vegetables_low = _to_float(totals.get("vegetable_servings")) < DAILY_RANGES["vegetable_servings"][0] * 0.8

    if carbs_high:
        score -= 5.0
    if fats_high:
        score -= 5.0
    if protein_low:
        score -= 8.0
    if vegetables_low:
        score -= 8.0

    final_score = int(round(_clamp(score, 0.0, 100.0)))
    balanced = (in_range_count >= 4) and (final_score >= 70)

    breakdown["balance"] = {
        "in_range_count": in_range_count,
        "carbs_high": carbs_high,
        "fats_high": fats_high,
        "protein_low": protein_low,
        "vegetables_low": vegetables_low,
    }
    return final_score, balanced, breakdown


def _week_bounds(day):
    week_start = day - timedelta(days=day.weekday())
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


def _get_or_create_profile(user):
    profile, _ = NutritionGamificationProfile.objects.get_or_create(user=user)
    return profile


def _reward_exists(user, event_type, title=None, reference_date=None):
    qs = NutritionRewardEvent.objects.filter(user=user, event_type=event_type)
    if title is not None:
        qs = qs.filter(title=title)
    if reference_date is not None:
        qs = qs.filter(reference_date=reference_date)
    return qs.exists()


def _add_reward(user, event_type, title, description="", points=0, reference_date=None, metadata=None):
    reward = NutritionRewardEvent.objects.create(
        user=user,
        event_type=event_type,
        title=title,
        description=description,
        points=int(points or 0),
        reference_date=reference_date,
        metadata=metadata or {},
    )

    profile = _get_or_create_profile(user)
    old_level = profile.level
    profile.points += max(int(points or 0), 0)
    profile.level = max(1, (profile.points // 100) + 1)
    profile.save(update_fields=["points", "level", "updated_at"])

    if profile.level > old_level:
        NutritionRewardEvent.objects.create(
            user=user,
            event_type=NutritionRewardEvent.EVENT_LEVEL_UP,
            title=f"Level {profile.level} unlocked",
            description="Your nutrition consistency has increased your level.",
            points=0,
            reference_date=timezone.localdate(),
            metadata={"new_level": profile.level},
        )

    return reward


def recompute_daily_score(user, day):
    aggregates = CookedRecipeLog.objects.filter(user=user, cooked_at__date=day).aggregate(
        calories=Sum("calories"),
        protein=Sum("protein"),
        carbs=Sum("carbs"),
        fats=Sum("fats"),
        vegetable_servings=Sum("vegetable_servings"),
    )
    totals = {
        "calories": _to_float(aggregates.get("calories")),
        "protein": _to_float(aggregates.get("protein")),
        "carbs": _to_float(aggregates.get("carbs")),
        "fats": _to_float(aggregates.get("fats")),
        "vegetable_servings": _to_float(aggregates.get("vegetable_servings")),
    }
    score, balanced, breakdown = _compute_daily_score(totals)

    daily, _ = DailyNutritionScore.objects.update_or_create(
        user=user,
        date=day,
        defaults={
            "total_calories": totals["calories"],
            "total_protein": totals["protein"],
            "total_carbs": totals["carbs"],
            "total_fats": totals["fats"],
            "total_vegetable_servings": totals["vegetable_servings"],
            "score": score,
            "balanced": balanced,
            "breakdown": breakdown,
        },
    )
    return daily


def recompute_weekly_score(user, day):
    week_start, week_end = _week_bounds(day)
    dailies = DailyNutritionScore.objects.filter(
        user=user,
        date__range=(week_start, week_end),
    )

    days_tracked = dailies.count()
    totals = dailies.aggregate(
        calories=Sum("total_calories"),
        protein=Sum("total_protein"),
        carbs=Sum("total_carbs"),
        fats=Sum("total_fats"),
        vegetable_servings=Sum("total_vegetable_servings"),
    )
    average_score = 0.0
    balanced_days = 0
    if days_tracked > 0:
        score_sum = dailies.aggregate(total=Sum("score")).get("total") or 0
        average_score = round(float(score_sum) / float(days_tracked), 2)
        balanced_days = dailies.filter(balanced=True).count()

    weekly, _ = WeeklyNutritionScore.objects.update_or_create(
        user=user,
        week_start=week_start,
        defaults={
            "week_end": week_end,
            "average_score": average_score,
            "days_tracked": days_tracked,
            "balanced_days": balanced_days,
            "total_calories": _to_float(totals.get("calories")),
            "total_protein": _to_float(totals.get("protein")),
            "total_carbs": _to_float(totals.get("carbs")),
            "total_fats": _to_float(totals.get("fats")),
            "total_vegetable_servings": _to_float(totals.get("vegetable_servings")),
        },
    )
    return weekly


def _compute_current_streak(user, end_day):
    qualified = set(
        DailyNutritionScore.objects.filter(
            user=user,
            score__gte=70,
            date__lte=end_day,
        ).values_list("date", flat=True)
    )
    streak = 0
    cursor = end_day
    while cursor in qualified:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _apply_gamification(user, cooked_log, daily_score, weekly_score):
    _add_reward(
        user=user,
        event_type=NutritionRewardEvent.EVENT_COOK_LOG,
        title="Cooked recipe logged",
        description=f"{cooked_log.recipe_name} added to nutrition timeline.",
        points=5,
        reference_date=daily_score.date,
        metadata={"recipe_id": cooked_log.recipe_id, "recipe_name": cooked_log.recipe_name},
    )

    # One daily balance reward per day.
    if daily_score.score >= 80 and not _reward_exists(
        user,
        NutritionRewardEvent.EVENT_DAILY_BALANCE,
        reference_date=daily_score.date,
    ):
        _add_reward(
            user=user,
            event_type=NutritionRewardEvent.EVENT_DAILY_BALANCE,
            title="Balanced day",
            description="Great nutrient balance today.",
            points=10,
            reference_date=daily_score.date,
            metadata={"score": daily_score.score},
        )

    profile = _get_or_create_profile(user)
    profile.current_streak = _compute_current_streak(user, daily_score.date)
    profile.longest_streak = max(profile.longest_streak, profile.current_streak)
    profile.save(update_fields=["current_streak", "longest_streak", "updated_at"])

    for milestone in STREAK_MILESTONES:
        title = f"{milestone}-day streak"
        if profile.current_streak >= milestone and not _reward_exists(
            user,
            NutritionRewardEvent.EVENT_STREAK_BONUS,
            title=title,
        ):
            _add_reward(
                user=user,
                event_type=NutritionRewardEvent.EVENT_STREAK_BONUS,
                title=title,
                description=f"You maintained a healthy streak for {milestone} days.",
                points=milestone * 2,
                reference_date=daily_score.date,
                metadata={"milestone": milestone, "current_streak": profile.current_streak},
            )

    # One healthy-week badge per week.
    if (
        weekly_score.average_score >= 80
        and weekly_score.days_tracked >= 5
        and not _reward_exists(
            user,
            NutritionRewardEvent.EVENT_HEALTHY_WEEK_BADGE,
            reference_date=weekly_score.week_start,
        )
    ):
        _add_reward(
            user=user,
            event_type=NutritionRewardEvent.EVENT_HEALTHY_WEEK_BADGE,
            title="Healthy week badge",
            description="Excellent weekly nutrition consistency.",
            points=50,
            reference_date=weekly_score.week_start,
            metadata={"average_score": weekly_score.average_score},
        )
        profile = _get_or_create_profile(user)
        profile.healthy_week_badges += 1
        profile.save(update_fields=["healthy_week_badges", "updated_at"])


@transaction.atomic
def record_cooked_recipe(user, recipe_id, recipe_name, nutrition_totals, parsed_ingredients, cooked_at=None):
    cooked_at = cooked_at or timezone.now()

    vegetable_servings = _estimate_vegetable_servings(parsed_ingredients)
    log = CookedRecipeLog.objects.create(
        user=user,
        recipe_id=recipe_id,
        recipe_name=recipe_name or "Cooked Recipe",
        cooked_at=cooked_at,
        calories=_to_float(nutrition_totals.get("calories")),
        protein=_to_float(nutrition_totals.get("protein")),
        carbs=_to_float(nutrition_totals.get("carbs")),
        fats=_to_float(nutrition_totals.get("fat")),
        vegetable_servings=vegetable_servings,
    )

    day = timezone.localtime(cooked_at).date()
    daily_score = recompute_daily_score(user, day)
    weekly_score = recompute_weekly_score(user, day)
    _apply_gamification(user, log, daily_score, weekly_score)
    profile = _get_or_create_profile(user)

    return {
        "daily_score": daily_score.score,
        "daily_date": str(daily_score.date),
        "weekly_score": weekly_score.average_score,
        "week_start": str(weekly_score.week_start),
        "vegetable_servings": vegetable_servings,
        "points": profile.points,
        "level": profile.level,
        "current_streak": profile.current_streak,
    }
