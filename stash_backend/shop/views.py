from django.db import transaction
from django.db.models import F
from django.utils import timezone

from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Product, Cart, CartItem, Order, OrderItem
from .serializers import ProductSerializer, CartSerializer, OrderSerializer
from .permissions import IsShopOwner

from inventory.models import PantryItem


# ----------------------------
# Helpers
# ----------------------------
def _get_cart(user):
    cart, _ = Cart.objects.get_or_create(user=user)
    return cart


def convert_to_default_unit(amount: float, from_unit: str, ingredient_default_unit: str):
    """
    Converts shop unit to inventory base unit.
    Your Ingredient.default_unit values should be: "grams" / "ml" / "pcs"

    Returns converted amount (float) if convertible and matches ingredient_default_unit,
    else returns None.
    """
    u = (from_unit or "").lower().strip()
    target = (ingredient_default_unit or "").lower().strip()

    # normalize shop -> inventory units
    if u == "kg":
        amount, u = amount * 1000.0, "grams"
    elif u == "g":
        amount, u = amount, "grams"
    elif u == "l":
        amount, u = amount * 1000.0, "ml"
    elif u == "ml":
        amount, u = amount, "ml"
    elif u == "pcs":
        amount, u = amount, "pcs"

    # must match ingredient base unit
    if u != target:
        return None
    return float(amount)


# ----------------------------
# PRODUCT CRUD (Shop Owner)
# ----------------------------
class AddProductView(generics.CreateAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsShopOwner]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class MyProductsView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsShopOwner]

    def get_queryset(self):
        return Product.objects.filter(owner=self.request.user)


class UpdateProductView(generics.UpdateAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsShopOwner]

    def get_queryset(self):
        return Product.objects.filter(owner=self.request.user)


class DeleteProductView(generics.DestroyAPIView):
    permission_classes = [IsShopOwner]

    def get_queryset(self):
        return Product.objects.filter(owner=self.request.user)


class PublicProductListView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Product.objects.filter(is_active=True)


# ----------------------------
# CART APIs
# ----------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_cart(request):
    return Response(CartSerializer(_get_cart(request.user)).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cart_add(request):
    """
    { "product_id": 1, "quantity": 2 }
    """
    product_id = request.data.get("product_id")
    qty = int(request.data.get("quantity", 1))

    if not product_id or qty <= 0:
        return Response({"error": "product_id and quantity>0 required"}, status=400)

    product = Product.objects.filter(id=product_id, is_active=True).first()
    if not product:
        return Response({"error": "Product not found"}, status=404)

    cart = _get_cart(request.user)
    item, created = CartItem.objects.get_or_create(
        cart=cart, product=product, defaults={"quantity": qty}
    )
    if not created:
        item.quantity += qty
        item.save(update_fields=["quantity"])

    return Response(CartSerializer(cart).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cart_update(request, item_id):
    """
    { "quantity": 3 } (0 => remove)
    """
    cart = _get_cart(request.user)
    item = CartItem.objects.filter(id=item_id, cart=cart).first()
    if not item:
        return Response({"error": "Cart item not found"}, status=404)

    qty = int(request.data.get("quantity", item.quantity))
    if qty <= 0:
        item.delete()
    else:
        item.quantity = qty
        item.save(update_fields=["quantity"])

    return Response(CartSerializer(cart).data)


# ----------------------------
# ORDER APIs
# ----------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def checkout(request):
    """
    Creates order from cart, reduces stock_quantity, clears cart.
    Also snapshots unit/pack_size/pack_unit into OrderItem.
    """
    cart = _get_cart(request.user)
    cart_items = list(CartItem.objects.select_related("product").filter(cart=cart))
    if not cart_items:
        return Response({"error": "Cart is empty"}, status=400)

    with transaction.atomic():
        pids = [ci.product_id for ci in cart_items]
        products = {p.id: p for p in Product.objects.select_for_update().filter(id__in=pids)}

        for ci in cart_items:
            p = products[ci.product_id]
            if p.stock_quantity < ci.quantity:
                return Response(
                    {"error": "out_of_stock", "product": p.name, "have": p.stock_quantity, "need": ci.quantity},
                    status=400,
                )

        order = Order.objects.create(user=request.user, status="PLACED")
        total = 0.0

        for ci in cart_items:
            p = products[ci.product_id]

            p.stock_quantity = int(p.stock_quantity) - int(ci.quantity)
            p.save(update_fields=["stock_quantity"])

            OrderItem.objects.create(
                order=order,
                product=p,
                quantity=ci.quantity,
                price_each=p.price,
                unit=p.unit,
                pack_size=float(p.pack_size or 1),
                pack_unit=str(p.pack_unit or p.unit),
            )

            total += float(ci.quantity) * float(p.price)

        order.total_amount = total
        order.save(update_fields=["total_amount"])

        CartItem.objects.filter(cart=cart).delete()

    return Response(OrderSerializer(order).data, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_order(request, order_id):
    with transaction.atomic():
        order = Order.objects.select_for_update().filter(id=order_id, user=request.user).first()
        if not order:
            return Response({"error": "Order not found"}, status=404)

        if order.status != "PLACED":
            return Response({"error": f"Cannot cancel in status {order.status}"}, status=400)

        for oi in OrderItem.objects.filter(order=order):
            Product.objects.filter(id=oi.product_id).update(stock_quantity=F("stock_quantity") + oi.quantity)

        order.status = "CANCELLED"
        order.save(update_fields=["status"])

    return Response(OrderSerializer(order).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_delivered(request, order_id):
    order = Order.objects.filter(id=order_id, user=request.user).first()
    if not order:
        return Response({"error": "Order not found"}, status=404)
    if order.status != "PLACED":
        return Response({"error": f"Cannot deliver in status {order.status}"}, status=400)

    order.status = "DELIVERED"
    order.delivered_at = timezone.now()
    order.needs_pantry_confirm = True
    order.save(update_fields=["status", "delivered_at", "needs_pantry_confirm"])
    return Response(OrderSerializer(order).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def confirm_add_to_pantry(request, order_id):
    """
    { "add_to_pantry": true }

    ✅ Converts pack_unit -> Ingredient.default_unit
    ✅ Returns debug info: applied + skipped
    """
    add_to_pantry = bool(request.data.get("add_to_pantry", False))

    with transaction.atomic():
        order = Order.objects.select_for_update().filter(id=order_id, user=request.user).first()
        if not order:
            return Response({"error": "Order not found"}, status=404)

        if order.status != "DELIVERED" or not order.needs_pantry_confirm:
            return Response({"error": "Order not awaiting pantry confirmation"}, status=400)

        if order.pantry_applied:
            return Response({"error": "Already applied to pantry"}, status=400)

        applied = []
        skipped = []

        if add_to_pantry:
            pantry_rows = PantryItem.objects.select_for_update().select_related("ingredient").filter(user=request.user)
            pantry_map = {p.ingredient_id: p for p in pantry_rows}

            order_items = OrderItem.objects.select_related("product", "product__ingredient").filter(order=order)

            for oi in order_items:
                p = oi.product
                ing = getattr(p, "ingredient", None)

                if not ing:
                    skipped.append({"product": p.name, "reason": "product.ingredient is null"})
                    continue

                total_amount = float(oi.quantity) * float(oi.pack_size or 1)
                converted = convert_to_default_unit(
                    total_amount,
                    (oi.pack_unit or oi.unit),
                    ing.default_unit
                )

                if converted is None:
                    skipped.append({
                        "product": p.name,
                        "ingredient": ing.name,
                        "reason": f"unit mismatch (pack_unit={oi.pack_unit}, ingredient.default_unit={ing.default_unit})"
                    })
                    continue

                existing = pantry_map.get(ing.id)
                if existing:
                    existing.quantity = float(existing.quantity or 0) + float(converted)
                    existing.save(update_fields=["quantity"])
                else:
                    existing = PantryItem.objects.create(
                        user=request.user,
                        ingredient=ing,
                        quantity=float(converted),
                    )
                    pantry_map[ing.id] = existing

                applied.append({"ingredient": ing.name, "added": converted, "unit": ing.default_unit})

            order.pantry_applied = True

        order.status = "COMPLETED"
        order.needs_pantry_confirm = False
        order.save(update_fields=["status", "needs_pantry_confirm", "pantry_applied"])

    return Response({
        "status": "ok",
        "order_id": order.id,
        "applied": applied,
        "skipped": skipped
    }, status=200)
