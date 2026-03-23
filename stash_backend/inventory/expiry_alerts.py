from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from accounts.models import Notification

from .models import PantryItemBatch


EXPIRY_ALERT_WINDOW_DAYS = 3


def _pluralize_days(days: int) -> str:
    return "day" if days == 1 else "days"


def get_expiry_status(expiry_date, today=None):
    if not expiry_date:
        return None, None

    today = today or timezone.localdate()
    days_until_expiry = (expiry_date - today).days

    if days_until_expiry < 0:
        return "expired", days_until_expiry
    if days_until_expiry == 0:
        return "expires_today", days_until_expiry
    if days_until_expiry <= EXPIRY_ALERT_WINDOW_DAYS:
        return "expiring_soon", days_until_expiry
    return "fresh", days_until_expiry


def _build_expiry_alert(batch: PantryItemBatch, today):
    expiry_date = batch.expiry_date
    if not expiry_date:
        return None

    status, days_until_expiry = get_expiry_status(expiry_date, today=today)
    item = batch.pantry_item
    ingredient_name = (item.ingredient.name or "This item").strip()
    batch_quantity = round(float(batch.quantity or 0.0), 2)
    batch_unit = (item.ingredient.default_unit or "units").strip()
    formatted_date = expiry_date.strftime("%d %b %Y")

    if status == "expired":
        title = "Pantry batch expired"
        message = (
            f"{ingredient_name} batch ({batch_quantity} {batch_unit}) expired on {formatted_date}. "
            "Please check it before using it."
        )
    elif status == "expires_today":
        title = "Pantry batch expires today"
        message = f"{ingredient_name} batch ({batch_quantity} {batch_unit}) expires today. Try to use it soon."
    elif status == "expiring_soon":
        title = "Pantry batch expiring soon"
        message = (
            f"{ingredient_name} batch ({batch_quantity} {batch_unit}) expires in "
            f"{days_until_expiry} {_pluralize_days(days_until_expiry)} on {formatted_date}. "
            "Plan to use it soon."
        )
    else:
        return None

    data = {
        "kind": "pantry_expiry",
        "pantry_item_id": item.id,
        "pantry_batch_id": batch.id,
        "ingredient_id": item.ingredient_id,
        "ingredient_name": ingredient_name,
        "batch_quantity": batch_quantity,
        "unit": batch_unit,
        "expiry_date": expiry_date.isoformat(),
        "days_until_expiry": days_until_expiry,
        "status": status,
    }

    return {
        "key": (batch.id, expiry_date.isoformat(), status),
        "title": title,
        "message": message,
        "data": data,
    }


def sync_expiry_notifications_for_user(user) -> int:
    if not getattr(user, "is_authenticated", False):
        return 0

    today = timezone.localdate()
    alert_cutoff = today + timedelta(days=EXPIRY_ALERT_WINDOW_DAYS)
    pantry_batches = list(
        PantryItemBatch.objects.select_related("pantry_item", "pantry_item__ingredient").filter(
            pantry_item__user=user,
            quantity__gt=0,
            expiry_date__isnull=False,
            expiry_date__lte=alert_cutoff,
        )
    )

    desired_alerts = []
    desired_keys = set()
    for batch in pantry_batches:
        alert = _build_expiry_alert(batch, today)
        if not alert:
            continue
        desired_alerts.append(alert)
        desired_keys.add(alert["key"])

    existing_by_key = {}
    pantry_notifications = Notification.objects.filter(user=user, type="system").order_by("-created_at")
    for notification in pantry_notifications:
        data = notification.data if isinstance(notification.data, dict) else {}
        if data.get("kind") != "pantry_expiry":
            continue

        key = (
            data.get("pantry_batch_id"),
            data.get("expiry_date"),
            data.get("status"),
        )
        if key not in desired_keys:
            if not notification.is_read:
                notification.is_read = True
                notification.save(update_fields=["is_read"])
            continue

        existing_by_key.setdefault(key, notification)

    created_count = 0
    for alert in desired_alerts:
        notification = existing_by_key.get(alert["key"])
        if notification:
            changed_fields = []
            if notification.title != alert["title"]:
                notification.title = alert["title"]
                changed_fields.append("title")
            if notification.message != alert["message"]:
                notification.message = alert["message"]
                changed_fields.append("message")
            if notification.data != alert["data"]:
                notification.data = alert["data"]
                changed_fields.append("data")
            if changed_fields:
                notification.save(update_fields=changed_fields)
            continue

        Notification.objects.create(
            user=user,
            title=alert["title"],
            message=alert["message"],
            type="system",
            data=alert["data"],
        )
        created_count += 1

    return created_count


def sync_expiry_notifications_for_all_users() -> dict[str, int]:
    User = get_user_model()
    users = User.objects.filter(is_active=True)

    processed_users = 0
    created_notifications = 0
    for user in users.iterator():
        processed_users += 1
        created_notifications += sync_expiry_notifications_for_user(user)

    return {
        "processed_users": processed_users,
        "created_notifications": created_notifications,
    }
