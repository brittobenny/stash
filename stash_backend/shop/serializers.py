from rest_framework import serializers
from inventory.models import Ingredient
from .models import Category, Product, Cart, CartItem, Order, OrderItem, ShopProfile, StockMovement, Feedback


# -------------------
# CATEGORY
# -------------------
class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "image"]


# -------------------
# PRODUCT
# -------------------
class ProductSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source="owner.username")
    owner_location = serializers.ReadOnlyField(source="owner.userprofile.location")
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
            "owner_location",
            "category",
            "category_name",
            "name",
            "price",
            "stock_quantity",
            "low_stock_threshold",
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
    user_email = serializers.ReadOnlyField(source="user.email")
    user_location = serializers.ReadOnlyField(source="user.userprofile.location")
    user_address = serializers.ReadOnlyField(source="user.userprofile.address")
    user_phone = serializers.ReadOnlyField(source="user.userprofile.mobile_number")
    payment_status = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "user_email",
            "user_location",
            "user_address",
            "user_phone",
            "status",
            "payment_status",
            "total_amount",
            "created_at",
            "updated_at",
            "delivered_at",
            "cancelled_at",
            "refunded_at",
            "cancellation_reason",
            "refund_reason",
            "needs_pantry_confirm",
            "pantry_applied",
            "items",
        ]

    def get_payment_status(self, obj):
        if obj.status == "REFUNDED":
            return "REFUNDED"
        if obj.status == "CANCELLED":
            return "CANCELLED"
        return "PAID"


class ShopProfileSerializer(serializers.ModelSerializer):
    owner_email = serializers.ReadOnlyField(source="owner.email")

    class Meta:
        model = ShopProfile
        fields = [
            "id",
            "owner",
            "owner_email",
            "store_name",
            "address",
            "location",
            "phone",
            "hours",
            "delivery_radius_km",
            "min_order_amount",
            "tax_rate",
            "service_fee",
            "logo",
            "banner",
            "updated_at",
        ]
        read_only_fields = ["owner", "updated_at", "owner_email"]


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source="product.name")

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "product",
            "product_name",
            "change",
            "reason",
            "note",
            "created_by",
            "created_at",
        ]
        read_only_fields = ["created_by", "created_at", "product_name"]


class FeedbackSerializer(serializers.ModelSerializer):
    user_email = serializers.ReadOnlyField(source="user.email")
    user_name = serializers.ReadOnlyField(source="user.first_name")
    shop_owner_email = serializers.ReadOnlyField(source="shop_owner.email")

    class Meta:
        model = Feedback
        fields = [
            "id",
            "user",
            "user_email",
            "user_name",
            "shop_owner",
            "shop_owner_email",
            "order",
            "rating",
            "title",
            "message",
            "status",
            "created_at",
        ]
        read_only_fields = ["user", "shop_owner", "created_at", "user_email", "user_name", "shop_owner_email"]
