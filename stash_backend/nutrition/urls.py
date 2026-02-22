from django.urls import path

from .views import (
    daily_scores,
    weekly_scores,
    reward_history,
    profile_summary,
    cooked_history,
    recalculate_scores,
)


urlpatterns = [
    path("daily/", daily_scores),
    path("weekly/", weekly_scores),
    path("rewards/", reward_history),
    path("profile/", profile_summary),
    path("cooked/", cooked_history),
    path("recalculate/", recalculate_scores),
]
