from rest_framework import serializers

from .models import Recipe


class RecipeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recipe
        fields = [
            "id",
            "title",
            "ingredients",
            "quantities",
            "hero_ingredient",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "hero_ingredient", "created_by", "created_at", "updated_at"]
