from __future__ import annotations

from accounts.models import Notification

DEFAULT_LOW_STOCK_LIMITS = {
    "grams": 250.0,
    "ml": 500.0,
    "pcs": 2.0,
}


def normalize_pantry_unit(unit: str | None) -> str:
    value = str(unit or "").strip().lower()
    if value in {"g", "gram", "grams"}:
        return "grams"
    if value in {"ml", "milliliter", "milliliters"}:
        return "ml"
    if value in {"pcs", "pc", "piece", "pieces"}:
        return "pcs"
    return value or "pcs"


def get_default_low_stock_limit(unit: str | None) -> float:
    normalized = normalize_pantry_unit(unit)
    return float(DEFAULT_LOW_STOCK_LIMITS.get(normalized, 1.0))


def get_effective_low_stock_limit(low_stock_limit, unit: str | None) -> float:
    try:
        explicit = float(low_stock_limit)
    except (TypeError, ValueError):
        explicit = None

    if explicit is not None and explicit > 0:
        return explicit
    return get_default_low_stock_limit(unit)


def build_low_stock_snapshot(item) -> dict:
    unit = getattr(getattr(item, "ingredient", None), "default_unit", None)
    effective_limit = get_effective_low_stock_limit(getattr(item, "low_stock_limit", None), unit)
    quantity = float(getattr(item, "quantity", 0) or 0)
    is_low_stock = quantity <= effective_limit
    return {
        "unit": normalize_pantry_unit(unit),
        "effective_low_stock_limit": effective_limit,
        "is_low_stock": is_low_stock,
        "shortfall": max(0.0, effective_limit - quantity),
    }


def sync_low_stock_notifications_for_user(user) -> int:
    if not getattr(user, "is_authenticated", False):
        return 0

    from .models import PantryItem

    pantry_items = list(
        PantryItem.objects.select_related("ingredient").filter(
            user=user,
            low_stock_limit__isnull=False,
        )
    )

    desired_alerts = []
    desired_keys = set()
    for item in pantry_items:
        snapshot = build_low_stock_snapshot(item)
        if not snapshot["is_low_stock"]:
            continue

        quantity = float(item.quantity or 0)
        key = (item.id, "pantry_low_stock")
        desired_keys.add(key)
        desired_alerts.append(
            {
                "key": key,
                "title": "Pantry item running low",
                "message": (
                    f"{item.ingredient.name} is below your low-stock limit. "
                    f"You have {round(quantity, 2)} {snapshot['unit']} left and your limit is "
                    f"{round(snapshot['effective_low_stock_limit'], 2)} {snapshot['unit']}."
                ),
                "data": {
                    "kind": "pantry_low_stock",
                    "pantry_item_id": item.id,
                    "ingredient_id": item.ingredient_id,
                    "ingredient_name": item.ingredient.name,
                    "current_quantity": round(quantity, 2),
                    "low_stock_limit": round(snapshot["effective_low_stock_limit"], 2),
                    "unit": snapshot["unit"],
                    "action": "restock_bill",
                    "route": "/customer/cart?source=restock",
                },
            }
        )

    existing_by_key = {}
    notifications = Notification.objects.filter(user=user, type="system").order_by("-created_at")
    for notification in notifications:
        data = notification.data if isinstance(notification.data, dict) else {}
        if data.get("kind") != "pantry_low_stock":
            continue
        key = (data.get("pantry_item_id"), "pantry_low_stock")
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


def sync_low_stock_notifications_for_all_users() -> dict:
    from django.contrib.auth import get_user_model

    processed_users = 0
    created_notifications = 0
    for user in get_user_model().objects.filter(is_active=True).iterator():
        processed_users += 1
        created_notifications += sync_low_stock_notifications_for_user(user)

    return {
        "processed_users": processed_users,
        "created_notifications": created_notifications,
    }
