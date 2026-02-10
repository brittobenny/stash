from rest_framework import serializers
from inventory.models import Ingredient
from .models import Category, Product, Cart, CartItem, Order, OrderItem


# -------------------
# CATEGORY
# -------------------
class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]


# -------------------
# PRODUCT
# -------------------
class ProductSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source="owner.username")
    category_name = serializers.ReadOnlyField(source="category.name")

    # show ingredient name in response
    ingredient_name = serializers.ReadOnlyField(source="ingredient.name")

    # allow sending ingredient id while creating/updating product
    ingredient_id = serializers.PrimaryKeyRelatedField(
        source="ingredient",
        queryset=Ingredient.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

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

            # pantry mapping
            "ingredient_name",
            "ingredient_id",
            "pack_size",
            "pack_unit",
        ]


# -------------------
# CART
# -------------------
class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = CartItem
        fields = ["id", "product", "product_id", "quantity"]


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)

    class Meta:
        model = Cart
        fields = ["id", "items", "updated_at"]


# -------------------
# ORDER
# -------------------
class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product",
            "quantity",
            "price_each",
            "unit",
            "pack_size",
            "pack_unit",
        ]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "status",
            "total_amount",
            "created_at",
            "delivered_at",
            "needs_pantry_confirm",
            "pantry_applied",
            "items",
        ]
