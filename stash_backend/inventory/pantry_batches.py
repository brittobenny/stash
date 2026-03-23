from __future__ import annotations

from django.db import models

from .models import PantryItem, PantryItemBatch


def ordered_pantry_batches_qs(queryset):
    return queryset.order_by(
        models.Case(
            models.When(expiry_date__isnull=True, then=models.Value(1)),
            default=models.Value(0),
            output_field=models.IntegerField(),
        ),
        "expiry_date",
        "created_at",
        "id",
    )


def refresh_pantry_item_from_batches(item: PantryItem):
    item.batches.filter(quantity__lte=0.0001).delete()
    active_batches = item.batches.filter(quantity__gt=0)

    if not active_batches.exists():
        item.delete()
        return None

    totals = active_batches.aggregate(total_quantity=models.Sum("quantity"))
    next_batch = active_batches.filter(expiry_date__isnull=False).order_by("expiry_date", "created_at", "id").first()
    next_expiry = next_batch.expiry_date if next_batch else None
    total_quantity = float(totals.get("total_quantity") or 0.0)

    changed_fields = []
    if float(item.quantity or 0.0) != total_quantity:
        item.quantity = total_quantity
        changed_fields.append("quantity")
    if item.expiry_date != next_expiry:
        item.expiry_date = next_expiry
        changed_fields.append("expiry_date")
    if changed_fields:
        item.save(update_fields=changed_fields)
    return item


def add_pantry_stock(*, user, ingredient, quantity: float, expiry_date=None, low_stock_limit=None):
    item, _ = PantryItem.objects.get_or_create(
        user=user,
        ingredient=ingredient,
        defaults={
            "quantity": 0.0,
            "expiry_date": expiry_date,
            "low_stock_limit": low_stock_limit,
        },
    )

    if low_stock_limit is not None and item.low_stock_limit != low_stock_limit:
        item.low_stock_limit = low_stock_limit
        item.save(update_fields=["low_stock_limit"])

    batch = item.batches.filter(expiry_date=expiry_date).first()
    if batch:
        batch.quantity = float(batch.quantity or 0.0) + float(quantity or 0.0)
        batch.save()
    else:
        batch = PantryItemBatch.objects.create(
            pantry_item=item,
            quantity=float(quantity or 0.0),
            expiry_date=expiry_date,
        )

    item = refresh_pantry_item_from_batches(item)
    return item, batch


def update_pantry_batch_record(batch: PantryItemBatch, *, quantity: float, expiry_date=None):
    parent = batch.pantry_item
    sibling = parent.batches.exclude(pk=batch.pk).filter(expiry_date=expiry_date).first()

    if sibling:
        sibling.quantity = float(sibling.quantity or 0.0) + float(quantity or 0.0)
        sibling.save()
        batch.delete()
        updated_batch = sibling
    else:
        batch.quantity = float(quantity or 0.0)
        batch.expiry_date = expiry_date
        batch.save()
        updated_batch = batch

    refreshed_item = refresh_pantry_item_from_batches(parent)
    return refreshed_item, updated_batch


def consume_pantry_quantity(item: PantryItem, amount: float):
    remaining = max(float(amount or 0.0), 0.0)
    consumed = 0.0
    details = []

    batches = ordered_pantry_batches_qs(
        item.batches.select_for_update().filter(quantity__gt=0)
    )

    for batch in batches:
        if remaining <= 0:
            break

        available = float(batch.quantity or 0.0)
        if available <= 0:
            continue

        used = min(available, remaining)
        batch.quantity = available - used
        batch_expiry = batch.expiry_date.isoformat() if batch.expiry_date else None
        batch_id = batch.id

        if batch.quantity <= 0.0001:
            batch.delete()
        else:
            batch.save()

        remaining -= used
        consumed += used
        details.append(
            {
                "batch_id": batch_id,
                "expiry_date": batch_expiry,
                "used_quantity": round(float(used), 2),
            }
        )

    refreshed_item = refresh_pantry_item_from_batches(item)
    return {
        "item": refreshed_item,
        "consumed": round(float(consumed), 2),
        "remaining": round(float(remaining), 2),
        "details": details,
    }
