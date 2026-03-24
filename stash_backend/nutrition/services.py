from datetime import timedelta, datetime, time

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

# Product-facing goal targets for progress cards and suggestions.
GOAL_TARGETS = {
    "calories": 2000.0,
    "protein": 90.0,
    "carbs": 250.0,
    "fats": 70.0,
    "vegetable_servings": 5.0,
}

MEAL_RANGES = {
    "calories": (250.0, 700.0),
    "protein": (18.0, 45.0),
    "carbs": (20.0, 80.0),
    "fats": (5.0, 28.0),
    "vegetable_servings": (1.0, 3.0),
}

MEAL_WEIGHTS = {
    "calories": 20.0,
    "protein": 25.0,
    "carbs": 15.0,
    "fats": 15.0,
    "vegetable_servings": 25.0,
}

MEAL_PENALTIES = {
    "calories": {"low": 0.9, "high": 1.2},
    "protein": {"low": 1.5, "high": 0.3},
    "carbs": {"low": 0.5, "high": 0.9},
    "fats": {"low": 0.3, "high": 1.2},
    "vegetable_servings": {"low": 1.4, "high": 0.1},
}

RECIPE_BADGE_RULES = (
    ("High Protein", lambda t: _to_float(t.get("protein")) >= 25.0),
    ("Fiber Rich", lambda t: _to_float(t.get("vegetable_servings")) >= 2.0),
    ("Low Calorie", lambda t: _to_float(t.get("calories")) <= 450.0),
    (
        "Balanced",
        lambda t: (
            _to_float(t.get("protein")) >= 20.0
            and 25.0 <= _to_float(t.get("carbs")) <= 90.0
            and 8.0 <= _to_float(t.get("fats")) <= 35.0
        ),
    ),
)


def _to_float(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _normalize_name(name: str) -> str:
    return " ".join(str(name or "").strip().lower().split())


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _safe_round(value: float, digits: int = 2) -> float:
    return round(_to_float(value), digits)


def _status_from_progress(value: float, goal: float) -> str:
    if goal <= 0:
        return "unknown"
    ratio = value / goal
    if ratio < 0.85:
        return "low"
    if ratio > 1.2:
        return "high"
    return "on_track"


def build_goal_progress(
    totals: dict,
    goals: dict | None = None,
) -> dict:
    goals = goals or GOAL_TARGETS
    progress = {}

    for metric, goal in goals.items():
        value = _to_float(totals.get(metric))
        percent = _clamp((value / max(goal, 1.0)) * 100.0, 0.0, 200.0)
        progress[metric] = {
            "value": _safe_round(value, 2),
            "goal": _safe_round(goal, 2),
            "percent": _safe_round(percent, 2),
            "status": _status_from_progress(value, goal),
            "delta": _safe_round(value - goal, 2),
        }
    return progress


def build_fix_my_plate_suggestions(
    totals: dict,
    goal_progress: dict | None = None,
) -> list[dict]:
    progress = goal_progress or build_goal_progress(totals)
    suggestions: list[dict] = []

    protein = progress.get("protein", {})
    if protein.get("status") == "low":
        suggestions.append(
            {
                "priority": "high",
                "metric": "protein",
                "title": "Boost protein",
                "action": "Add paneer, eggs, chicken, tofu, or chickpeas.",
            }
        )

    vegetables = progress.get("vegetable_servings", {})
    if vegetables.get("status") == "low":
        suggestions.append(
            {
                "priority": "high",
                "metric": "vegetable_servings",
                "title": "Add vegetables",
                "action": "Include a side salad or one cup cooked vegetables.",
            }
        )

    fats = progress.get("fats", {})
    if fats.get("status") == "high":
        suggestions.append(
            {
                "priority": "medium",
                "metric": "fats",
                "title": "Reduce added fat",
                "action": "Cut 1 tbsp oil/butter or switch to low-oil cooking.",
            }
        )

    carbs = progress.get("carbs", {})
    if carbs.get("status") == "high":
        suggestions.append(
            {
                "priority": "medium",
                "metric": "carbs",
                "title": "Balance carbs",
                "action": "Reduce rice/roti portion and add protein + veggies.",
            }
        )

    calories = progress.get("calories", {})
    if calories.get("status") == "high":
        suggestions.append(
            {
                "priority": "medium",
                "metric": "calories",
                "title": "Trim calories",
                "action": "Smaller portions and fewer fried/add-on items.",
            }
        )

    if not suggestions:
        suggestions.append(
            {
                "priority": "low",
                "metric": "overall",
                "title": "Great balance",
                "action": "Keep the same meal pattern and hydration today.",
            }
        )

    return suggestions[:4]


def build_recipe_nutrition_badges(totals: dict) -> list[str]:
    badges = [name for name, rule in RECIPE_BADGE_RULES if rule(totals)]
    return badges[:3]


def build_recipe_nutrition_insights(totals: dict) -> dict:
    normalized_totals = {
        "calories": _to_float(totals.get("calories")),
        "protein": _to_float(totals.get("protein")),
        "carbs": _to_float(totals.get("carbs")),
        "fats": _to_float(totals.get("fats") if totals.get("fats") is not None else totals.get("fat")),
        "vegetable_servings": _to_float(totals.get("vegetable_servings")),
    }
    score, balanced, _, _ = _compute_meal_quality(normalized_totals)
    progress = build_goal_progress(normalized_totals)
    suggestions = build_fix_my_plate_suggestions(normalized_totals, progress)
    badges = build_recipe_nutrition_badges(normalized_totals)
    return {
        "score": score,
        "balanced": balanced,
        "badges": badges,
        "goal_progress": progress,
        "fix_my_plate": suggestions,
    }


def build_weekly_trend_payload(user, end_day=None, days: int = 7) -> dict:
    end_day = end_day or timezone.localdate()
    start_day = end_day - timedelta(days=max(days - 1, 0))
    points_qs = DailyNutritionScore.objects.filter(
        user=user,
        date__range=(start_day, end_day),
    ).order_by("date")

    by_date = {row.date: int(row.score) for row in points_qs}
    points = []
    cursor = start_day
    while cursor <= end_day:
        score = by_date.get(cursor)
        points.append(
            {
                "date": str(cursor),
                "score": int(score or 0),
                "tracked": score is not None,
            }
        )
        cursor += timedelta(days=1)

    tracked_points = [point for point in points if point["tracked"]]
    if len(tracked_points) < 2:
        return {
            "direction": "flat",
            "delta": 0,
            "points": points,
            "tracked_days": len(tracked_points),
        }

    delta = tracked_points[-1]["score"] - tracked_points[0]["score"]
    if delta > 3:
        direction = "up"
    elif delta < -3:
        direction = "down"
    else:
        direction = "flat"
    return {
        "direction": direction,
        "delta": int(delta),
        "points": points,
        "tracked_days": len(tracked_points),
    }


def build_daily_comparison_payload(user, day) -> dict:
    previous_day = day - timedelta(days=1)
    current = DailyNutritionScore.objects.filter(user=user, date=day).first()
    previous = DailyNutritionScore.objects.filter(user=user, date=previous_day).first()

    if not current or not previous:
        return {
            "available": False,
            "message": "Not enough history for day-over-day comparison.",
        }

    payload = {
        "available": True,
        "score_delta": int(current.score) - int(previous.score),
        "calories_delta": _safe_round(current.total_calories - previous.total_calories, 2),
        "protein_delta": _safe_round(current.total_protein - previous.total_protein, 2),
        "carbs_delta": _safe_round(current.total_carbs - previous.total_carbs, 2),
        "fats_delta": _safe_round(current.total_fats - previous.total_fats, 2),
    }
    return payload


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


def _compute_meal_quality(totals: dict):
    breakdown = {}
    score = 0.0

    for metric, weight in MEAL_WEIGHTS.items():
        low, high = MEAL_RANGES[metric]
        ratio, in_range = _metric_ratio(
            _to_float(totals.get(metric)),
            low,
            high,
            MEAL_PENALTIES[metric]["low"],
            MEAL_PENALTIES[metric]["high"],
        )
        metric_points = weight * ratio
        score += metric_points
        breakdown[metric] = {
            "value": round(_to_float(totals.get(metric)), 2),
            "range": {"min": low, "max": high},
            "in_range": in_range,
            "points": round(metric_points, 2),
        }

    calories = _to_float(totals.get("calories"))
    protein = _to_float(totals.get("protein"))
    carbs = _to_float(totals.get("carbs"))
    fats = _to_float(totals.get("fats"))
    vegetables = _to_float(totals.get("vegetable_servings"))

    balanced = (
        250.0 <= calories <= 750.0
        and protein >= 18.0
        and 20.0 <= carbs <= 90.0
        and 5.0 <= fats <= 30.0
        and vegetables >= 1.0
    )

    junk_flags = {
        "very_high_calories": calories >= 800.0,
        "high_fat": fats >= 30.0,
        "high_carbs": carbs >= 95.0,
        "low_protein": protein < 12.0,
        "low_vegetables": vegetables < 0.5,
    }
    junk_signal_count = sum(int(flag) for flag in junk_flags.values())
    junk = (
        junk_signal_count >= 3
        or (calories >= 700.0 and fats >= 28.0)
        or (carbs >= 90.0 and protein < 12.0)
    )

    if balanced:
        score += 10.0
    score -= junk_signal_count * 6.0
    if junk:
        score -= 10.0

    final_score = int(round(_clamp(score, 0.0, 100.0)))
    breakdown["meal_quality"] = {
        "balanced": balanced,
        "junk": junk,
        "junk_signal_count": junk_signal_count,
        "junk_flags": junk_flags,
    }
    return final_score, balanced, junk, breakdown


def _compute_daily_score(totals: dict, meal_entries: list[dict] | None = None):
    if meal_entries is None:
        meal_score, balanced, junk, meal_breakdown = _compute_meal_quality(totals)
        breakdown = {
            "mode": "single_meal",
            "meal_count": 1,
            "balanced_ratio": 1.0 if balanced else 0.0,
            "junk_ratio": 1.0 if junk else 0.0,
            "average_meal_score": meal_score,
            "meals": [meal_breakdown],
        }
        return meal_score, balanced and not junk, breakdown

    if not meal_entries:
        return 0, False, {
            "mode": "daily_meal_quality",
            "meal_count": 0,
            "balanced_ratio": 0.0,
            "junk_ratio": 0.0,
            "average_meal_score": 0.0,
            "meals": [],
        }

    meal_breakdowns = []
    meal_scores = []
    balanced_count = 0
    junk_count = 0

    for meal in meal_entries:
        meal_score, balanced, junk, meal_breakdown = _compute_meal_quality(meal)
        meal_scores.append(meal_score)
        balanced_count += int(balanced)
        junk_count += int(junk)
        meal_breakdown["recipe_name"] = meal.get("recipe_name") or "Meal"
        meal_breakdown["score"] = meal_score
        meal_breakdowns.append(meal_breakdown)

    meal_count = len(meal_scores)
    average_meal_score = sum(meal_scores) / max(meal_count, 1)
    balanced_ratio = balanced_count / max(meal_count, 1)
    junk_ratio = junk_count / max(meal_count, 1)
    cumulative_raw = sum(meal_scores)
    final_score = int(round(_clamp(cumulative_raw, 0.0, 100.0)))
    balanced = final_score >= 70

    breakdown = {
        "mode": "daily_cumulative",
        "meal_count": meal_count,
        "balanced_meals": balanced_count,
        "junk_meals": junk_count,
        "balanced_ratio": round(balanced_ratio, 2),
        "junk_ratio": round(junk_ratio, 2),
        "average_meal_score": round(average_meal_score, 2),
        "cumulative_score_raw": round(cumulative_raw, 2),
        "meals": meal_breakdowns,
        "totals": {
            "calories": round(_to_float(totals.get("calories")), 2),
            "protein": round(_to_float(totals.get("protein")), 2),
            "carbs": round(_to_float(totals.get("carbs")), 2),
            "fats": round(_to_float(totals.get("fats")), 2),
            "vegetable_servings": round(_to_float(totals.get("vegetable_servings")), 2),
        },
    }
    return final_score, balanced, breakdown


def _week_bounds(day):
    week_start = day - timedelta(days=day.weekday())
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


def _day_bounds(day):
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(day, time.min), tz)
    end = timezone.make_aware(datetime.combine(day, time.max), tz)
    return start, end


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
    start_dt, end_dt = _day_bounds(day)
    logs = list(
        CookedRecipeLog.objects.filter(user=user, cooked_at__range=(start_dt, end_dt)).order_by("cooked_at")
    )

    aggregates = CookedRecipeLog.objects.filter(user=user, cooked_at__range=(start_dt, end_dt)).aggregate(
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
    meal_entries = [
        {
            "recipe_name": log.recipe_name,
            "calories": _to_float(log.calories),
            "protein": _to_float(log.protein),
            "carbs": _to_float(log.carbs),
            "fats": _to_float(log.fats),
            "vegetable_servings": _to_float(log.vegetable_servings),
        }
        for log in logs
    ]
    score, balanced, breakdown = _compute_daily_score(totals, meal_entries=meal_entries)

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
    today_totals = {
        "calories": _to_float(daily_score.total_calories),
        "protein": _to_float(daily_score.total_protein),
        "carbs": _to_float(daily_score.total_carbs),
        "fats": _to_float(daily_score.total_fats),
        "vegetable_servings": _to_float(daily_score.total_vegetable_servings),
    }
    daily_goal_progress = build_goal_progress(today_totals)
    recipe_insights = build_recipe_nutrition_insights(
        {
            "calories": _to_float(nutrition_totals.get("calories")),
            "protein": _to_float(nutrition_totals.get("protein")),
            "carbs": _to_float(nutrition_totals.get("carbs")),
            "fats": _to_float(nutrition_totals.get("fat")),
            "vegetable_servings": vegetable_servings,
        }
    )

    return {
        "daily_score": daily_score.score,
        "daily_date": str(daily_score.date),
        "weekly_score": weekly_score.average_score,
        "week_start": str(weekly_score.week_start),
        "vegetable_servings": vegetable_servings,
        "points": profile.points,
        "level": profile.level,
        "current_streak": profile.current_streak,
        "goal_progress": daily_goal_progress,
        "fix_my_plate": build_fix_my_plate_suggestions(today_totals, daily_goal_progress),
        "recipe_badges": recipe_insights.get("badges", []),
        "recipe_score": recipe_insights.get("score", 0),
    }
