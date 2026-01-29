from rest_framework import serializers
from .models import Product, Category

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]

class ProductSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source="owner.username")
    category_name = serializers.ReadOnlyField(source="category.name")

    class Meta:
        model = Product
        fields = [
            "id",
            "owner",
            "category",
            "category_name",
            "name",
            "price",
            "stock_quantity",
            "unit",
            "image",
            "is_active",
        ]
