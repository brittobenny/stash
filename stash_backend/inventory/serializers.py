from rest_framework import serializers
from .models import PantryItem
from .models import PantryItemBatch
from .models import InventoryItem
from .expiry_alerts import get_expiry_status
from .low_stock import build_low_stock_snapshot
from .pantry_batches import ordered_pantry_batches_qs


class PantryBatchSerializer(serializers.ModelSerializer):
    expiry_status = serializers.SerializerMethodField()
    days_until_expiry = serializers.SerializerMethodField()

    def get_expiry_status(self, obj):
        status, _ = get_expiry_status(obj.expiry_date)
        return status

    def get_days_until_expiry(self, obj):
        _, days = get_expiry_status(obj.expiry_date)
        return days

    class Meta:
        model = PantryItemBatch
        fields = [
            "id",
            "quantity",
            "expiry_date",
            "expiry_status",
            "days_until_expiry",
            "created_at",
            "updated_at",
        ]

class PantryItemSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(
        source="ingredient.name", read_only=True
    )
    category = serializers.CharField(
        source="ingredient.category", read_only=True
    )
    unit = serializers.CharField(
        source="ingredient.default_unit", read_only=True
    )
    image_url = serializers.CharField(
        source="ingredient.image_url", read_only=True
    )
    expiry_status = serializers.SerializerMethodField()
    days_until_expiry = serializers.SerializerMethodField()
    effective_low_stock_limit = serializers.SerializerMethodField()
    is_low_stock = serializers.SerializerMethodField()
    low_stock_shortfall = serializers.SerializerMethodField()
    batches = serializers.SerializerMethodField()
    batch_count = serializers.SerializerMethodField()

    def get_expiry_status(self, obj):
        status, _ = get_expiry_status(obj.expiry_date)
        return status

    def get_days_until_expiry(self, obj):
        _, days = get_expiry_status(obj.expiry_date)
        return days

    def get_effective_low_stock_limit(self, obj):
        return build_low_stock_snapshot(obj)["effective_low_stock_limit"]

    def get_is_low_stock(self, obj):
        return build_low_stock_snapshot(obj)["is_low_stock"]

    def get_low_stock_shortfall(self, obj):
        return build_low_stock_snapshot(obj)["shortfall"]

    def get_batches(self, obj):
        batches = getattr(obj, "prefetched_batches", None)
        if batches is None:
            batches = ordered_pantry_batches_qs(obj.batches.filter(quantity__gt=0))
        return PantryBatchSerializer(batches, many=True).data

    def get_batch_count(self, obj):
        batches = getattr(obj, "prefetched_batches", None)
        if batches is None:
            return obj.batches.filter(quantity__gt=0).count()
        return len(batches)

    class Meta:
        model = PantryItem
        fields = [
            "id",
            "ingredient",
            "ingredient_name",
            "category",
            "quantity",
            "unit",
            "image_url",
            "expiry_date",
            "low_stock_limit",
            "expiry_status",
            "days_until_expiry",
            "effective_low_stock_limit",
            "is_low_stock",
            "low_stock_shortfall",
            "batch_count",
            "batches",
        ]


class InventoryItemSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            "id",
            "ingredient",
            "ingredient_name",
            "quantity",
            "unit",
            "expiry_date"
        ]
