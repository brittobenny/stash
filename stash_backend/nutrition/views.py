from datetime import timedelta, datetime

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    DailyNutritionScore,
    WeeklyNutritionScore,
    NutritionRewardEvent,
    NutritionGamificationProfile,
    CookedRecipeLog,
)
from .serializers import (
    DailyNutritionScoreSerializer,
    WeeklyNutritionScoreSerializer,
    NutritionRewardEventSerializer,
    NutritionGamificationProfileSerializer,
    CookedRecipeLogSerializer,
)
from .services import recompute_daily_score, recompute_weekly_score


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def daily_scores(request):
    today = timezone.localdate()
    start = _parse_date(request.query_params.get("start")) or (today - timedelta(days=29))
    end = _parse_date(request.query_params.get("end")) or today

    qs = DailyNutritionScore.objects.filter(
        user=request.user,
        date__range=(start, end),
    ).order_by("-date")
    return Response(DailyNutritionScoreSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def weekly_scores(request):
    today = timezone.localdate()
    weeks = int(request.query_params.get("weeks", 8))
    weeks = max(1, min(weeks, 52))
    start = today - timedelta(days=(weeks * 7))

    qs = WeeklyNutritionScore.objects.filter(
        user=request.user,
        week_start__gte=start,
    ).order_by("-week_start")
    return Response(WeeklyNutritionScoreSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reward_history(request):
    limit = int(request.query_params.get("limit", 50))
    limit = max(1, min(limit, 200))
    qs = NutritionRewardEvent.objects.filter(user=request.user).order_by("-awarded_at")[:limit]
    return Response(NutritionRewardEventSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def cooked_history(request):
    limit = int(request.query_params.get("limit", 30))
    limit = max(1, min(limit, 200))
    qs = CookedRecipeLog.objects.filter(user=request.user).order_by("-cooked_at")[:limit]
    return Response(CookedRecipeLogSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profile_summary(request):
    profile, _ = NutritionGamificationProfile.objects.get_or_create(user=request.user)
    today = timezone.localdate()
    week_start = today - timedelta(days=today.weekday())

    today_score = DailyNutritionScore.objects.filter(user=request.user, date=today).first()
    week_score = WeeklyNutritionScore.objects.filter(user=request.user, week_start=week_start).first()
    latest_reward = NutritionRewardEvent.objects.filter(user=request.user).order_by("-awarded_at").first()

    data = NutritionGamificationProfileSerializer(profile).data
    data.update(
        {
            "today_score": today_score.score if today_score else 0,
            "today_balanced": today_score.balanced if today_score else False,
            "weekly_score": week_score.average_score if week_score else 0,
            "weekly_days_tracked": week_score.days_tracked if week_score else 0,
            "latest_reward": NutritionRewardEventSerializer(latest_reward).data if latest_reward else None,
        }
    )
    return Response(data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def recalculate_scores(request):
    date_value = _parse_date(request.data.get("date")) or timezone.localdate()
    daily = recompute_daily_score(request.user, date_value)
    weekly = recompute_weekly_score(request.user, date_value)
    return Response(
        {
            "date": str(date_value),
            "daily_score": daily.score,
            "weekly_score": weekly.average_score,
            "week_start": str(weekly.week_start),
        }
    )
