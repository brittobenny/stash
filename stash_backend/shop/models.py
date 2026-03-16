from django.db import models
from django.conf import settings

from inventory.models import Ingredient  # ✅ use your master ingredient table

User = settings.AUTH_USER_MODEL


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    image = models.ImageField(upload_to="categories/", blank=True, null=True)

    def __str__(self):
        return self.name


class Product(models.Model):
    UNIT_CHOICES = [
        ("g", "Grams"),
        ("kg", "Kilograms"),
        ("ml", "Millilitre"),
        ("l", "Litre"),
        ("pcs", "Pieces"),
        ("pack", "Pack"),  # treated like “1 pack”; you must set pack_size + pack_unit
    ]

    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        limit_choices_to={"userprofile__role": "shopowner"},
        related_name="shop_products",
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name="products",
    )

    name = models.CharField(max_length=150)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    # stock is in "number of product units" (same as cart quantity)
    stock_quantity = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=10)

    # UI/display unit (optional). Real pantry add is decided by pack_size/pack_unit below.
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default="pcs")

    image = models.ImageField(upload_to="products/", blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # ✅ IMPORTANT: map this product to pantry ingredient
    ingredient = models.ForeignKey(
        Ingredient,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
        help_text="Which pantry ingredient this product should update on delivery",
    )

    # ✅ IMPORTANT: how much pantry quantity this product adds per 1 unit bought
    # Example:
    #   Rice 1kg  -> pack_size=1,   pack_unit='kg', ingredient.default_unit='grams'
    #   Milk 500ml-> pack_size=500, pack_unit='ml', ingredient.default_unit='ml'
    #   Onion 1pc -> pack_size=1,   pack_unit='pcs',ingredient.default_unit='pcs'
    pack_size = models.FloatField(default=1)
    pack_unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default="pcs")

    def __str__(self):
        return self.name


class Cart(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="cart")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Cart({self.user})"


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)  # number of product units

    class Meta:
        unique_together = ("cart", "product")

    def __str__(self):
        return f"{self.cart.user} - {self.product.name} x {self.quantity}"


class Order(models.Model):
    STATUS = (
        ("PLACED", "PLACED"),
        ("CONFIRMED", "CONFIRMED"),
        ("PACKED", "PACKED"),
        ("OUT_FOR_DELIVERY", "OUT_FOR_DELIVERY"),
        ("DELIVERED", "DELIVERED"),
        ("COMPLETED", "COMPLETED"),
        ("CANCELLED", "CANCELLED"),
        ("REFUNDED", "REFUNDED"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="orders")
    status = models.CharField(max_length=20, choices=STATUS, default="PLACED")

    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    delivered_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(null=True, blank=True)
    refund_reason = models.TextField(null=True, blank=True)
    needs_pantry_confirm = models.BooleanField(default=False)
    pantry_applied = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Order({self.id}) - {self.user} - {self.status}"


class ShopProfile(models.Model):
    owner = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="shop_profile",
        limit_choices_to={"userprofile__role": "shopowner"},
    )
    store_name = models.CharField(max_length=160, blank=True)
    address = models.TextField(blank=True)
    location = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    hours = models.CharField(max_length=120, blank=True, help_text="Store hours e.g. 9 AM - 9 PM")
    delivery_radius_km = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    min_order_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Tax percentage")
    service_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    logo = models.ImageField(upload_to="shops/logos/", blank=True, null=True)
    banner = models.ImageField(upload_to="shops/banners/", blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.owner} shop profile"


class StockMovement(models.Model):
    REASONS = (
        ("RESTOCK", "Restock"),
        ("ADJUSTMENT", "Adjustment"),
        ("SALE", "Sale"),
        ("REFUND", "Refund"),
        ("BULK", "Bulk Upload"),
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_movements")
    change = models.IntegerField()
    reason = models.CharField(max_length=20, choices=REASONS, default="ADJUSTMENT")
    note = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.product.name} {self.change} ({self.reason})"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)  # number of product units

    # snapshot
    price_each = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=10)       # snapshot of product.unit
    pack_size = models.FloatField(default=1)     # snapshot of product.pack_size
    pack_unit = models.CharField(max_length=10, default="pcs")  # snapshot of product.pack_unit

    def __str__(self):
        return f"OrderItem({self.order.id}) - {self.product.name} x {self.quantity}"


class Feedback(models.Model):
    STATUS = (
        ("OPEN", "OPEN"),
        ("RESOLVED", "RESOLVED"),
        ("HIDDEN", "HIDDEN"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="feedbacks")
    shop_owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="shop_feedbacks",
        limit_choices_to={"userprofile__role": "shopowner"},
    )
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True)
    rating = models.PositiveIntegerField(default=5)
    title = models.CharField(max_length=120, blank=True)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS, default="OPEN")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Feedback({self.id}) {self.rating}* by {self.user}"
