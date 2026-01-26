from rest_framework import serializers
from .models import PantryItem

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

    class Meta:
        model = PantryItem
        fields = [
            "id",
            "ingredient",
            "ingredient_name",
            "category",
            "quantity",
            "unit",
            "expiry_date"
        ]
