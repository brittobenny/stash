import csv
from datetime import datetime, timedelta

from django.db import transaction
from django.db.models.deletion import ProtectedError
from django.db.models import F, Q, Sum, Count, DecimalField, ExpressionWrapper, Value
from django.db.models.functions import Coalesce, TruncDate, TruncWeek, TruncMonth
from django.utils import timezone
from django.http import HttpResponse

from rest_framework import generics, permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Product, Cart, CartItem, Order, OrderItem, Category, ShopProfile, StockMovement, Feedback
from accounts.models import UserProfile, Notification
from .serializers import ProductSerializer, CartSerializer, OrderSerializer, CategorySerializer, ShopProfileSerializer, StockMovementSerializer, FeedbackSerializer
from .permissions import IsShopOwner, IsAdmin

from inventory.models import PantryItem, Ingredient


# ----------------------------
# Helpers
# ----------------------------
def _get_cart(user):
    cart, _ = Cart.objects.get_or_create(user=user)
    return cart


def _notify(user, title, message, type="order", data=None):
    try:
        Notification.objects.create(
            user=user,
            title=title,
            message=message,
            type=type,
            data=data or {},
        )
    except Exception:
        pass


def _normalize_unit_key(unit: str) -> str:
    u = (unit or "").lower().strip()
    if u in {"g", "gram", "grams"}:
        return "grams"
    if u in {"kg", "kilogram", "kilograms"}:
        return "kg"
    if u in {"ml", "milliliter", "milliliters"}:
        return "ml"
    if u in {"l", "liter", "liters"}:
        return "l"
    if u in {"pcs", "pc", "piece", "pieces"}:
        return "pcs"
    return u


def convert_to_default_unit(amount: float, from_unit: str, ingredient_default_unit: str):
    """
    Converts shop unit to inventory base unit.
    Your Ingredient.default_unit values should be: "grams" / "ml" / "pcs"

    Returns converted amount (float) if convertible and matches ingredient_default_unit,
    else returns None.
    """
    u = _normalize_unit_key(from_unit)
    target = _normalize_unit_key(ingredient_default_unit)

    # normalize shop -> inventory units
    if u == "kg":
        amount, u = amount * 1000.0, "grams"
    elif u == "grams":
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


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _owner_analytics_payload(user, date_from, date_to):
    zero_decimal = Value(0, output_field=DecimalField(max_digits=14, decimal_places=2))
    revenue_expr = ExpressionWrapper(
        F("quantity") * F("price_each"),
        output_field=DecimalField(max_digits=14, decimal_places=2),
    )

    base_qs = OrderItem.objects.filter(
        product__owner=user,
        order__created_at__date__gte=date_from,
        order__created_at__date__lte=date_to,
    )
    sold_qs = base_qs.exclude(order__status__in=["CANCELLED", "REFUNDED"])

    summary = sold_qs.aggregate(
        total_revenue=Coalesce(Sum(revenue_expr), zero_decimal),
        total_items_sold=Coalesce(Sum("quantity"), Value(0)),
        total_orders=Count("order", distinct=True),
    )
    total_revenue = float(summary.get("total_revenue") or 0)
    total_items_sold = int(summary.get("total_items_sold") or 0)
    total_orders = int(summary.get("total_orders") or 0)
    avg_order_value = (total_revenue / total_orders) if total_orders else 0

    delivered_orders = sold_qs.filter(order__status__in=["DELIVERED", "COMPLETED"]).values("order_id").distinct().count()

    daily_rows = sold_qs.annotate(day=TruncDate("order__created_at")).values("day").annotate(
        revenue=Coalesce(Sum(revenue_expr), zero_decimal),
        orders=Count("order", distinct=True),
        items=Coalesce(Sum("quantity"), Value(0)),
    ).order_by("day")

    sales_by_day = [
        {
            "date": row["day"].isoformat() if row["day"] else "",
            "revenue": float(row["revenue"] or 0),
            "orders": int(row["orders"] or 0),
            "items": int(row["items"] or 0),
        }
        for row in daily_rows
    ]

    weekly_rows = sold_qs.annotate(week=TruncWeek("order__created_at")).values("week").annotate(
        revenue=Coalesce(Sum(revenue_expr), zero_decimal),
        orders=Count("order", distinct=True),
        items=Coalesce(Sum("quantity"), Value(0)),
    ).order_by("week")

    sales_by_week = [
        {
            "week": row["week"].date().isoformat() if row["week"] else "",
            "revenue": float(row["revenue"] or 0),
            "orders": int(row["orders"] or 0),
            "items": int(row["items"] or 0),
        }
        for row in weekly_rows
    ]

    monthly_rows = sold_qs.annotate(month=TruncMonth("order__created_at")).values("month").annotate(
        revenue=Coalesce(Sum(revenue_expr), zero_decimal),
        orders=Count("order", distinct=True),
        items=Coalesce(Sum("quantity"), Value(0)),
    ).order_by("month")

    sales_by_month = [
        {
            "month": row["month"].date().isoformat() if row["month"] else "",
            "revenue": float(row["revenue"] or 0),
            "orders": int(row["orders"] or 0),
            "items": int(row["items"] or 0),
        }
        for row in monthly_rows
    ]

    top_rows = sold_qs.values("product_id", "product__name").annotate(
        units_sold=Coalesce(Sum("quantity"), Value(0)),
        revenue=Coalesce(Sum(revenue_expr), zero_decimal),
    ).order_by("-units_sold", "-revenue")[:8]
    product_map = {
        p.id: p
        for p in Product.objects.filter(owner=user).only("id", "stock_quantity", "low_stock_threshold")
    }
    top_products = []
    for row in top_rows:
        product_obj = product_map.get(row["product_id"])
        stock_quantity = int(product_obj.stock_quantity) if product_obj else 0
        low_stock_threshold = int(product_obj.low_stock_threshold) if product_obj else 0
        top_products.append({
            "product_id": row["product_id"],
            "name": row["product__name"],
            "units_sold": int(row["units_sold"] or 0),
            "revenue": float(row["revenue"] or 0),
            "stock_quantity": stock_quantity,
            "low_stock_threshold": low_stock_threshold,
            "low_stock": stock_quantity <= low_stock_threshold,
        })

    low_stock_qs = Product.objects.filter(
        owner=user,
        is_active=True,
        stock_quantity__lte=F("low_stock_threshold"),
    ).order_by("stock_quantity", "name")
    low_stock_alerts = [
        {
            "product_id": p.id,
            "name": p.name,
            "stock_quantity": int(p.stock_quantity),
            "low_stock_threshold": int(p.low_stock_threshold),
            "is_out_of_stock": int(p.stock_quantity) == 0,
        }
        for p in low_stock_qs
    ]
    out_of_stock_count = sum(1 for x in low_stock_alerts if x["is_out_of_stock"])

    return {
        "date_range": {"from": date_from.isoformat(), "to": date_to.isoformat()},
        "summary": {
            "total_revenue": round(total_revenue, 2),
            "total_items_sold": total_items_sold,
            "total_orders": total_orders,
            "avg_order_value": round(avg_order_value, 2),
            "delivered_orders": int(delivered_orders),
            "low_stock_count": len(low_stock_alerts),
            "out_of_stock_count": out_of_stock_count,
        },
        "sales_by_day": sales_by_day,
        "sales_by_week": sales_by_week,
        "sales_by_month": sales_by_month,
        "top_products": top_products,
        "low_stock_alerts": low_stock_alerts,
    }


# ----------------------------
# PRODUCT CRUD (Shop Owner)
# ----------------------------
class AddProductView(generics.CreateAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsShopOwner]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        data = serializer.validated_data
        unit = data.get("unit") or "pcs"
        pack_unit = data.get("pack_unit") or unit
        pack_size = data.get("pack_size") or 1
        ingredient = data.get("ingredient")
        if not ingredient:
            name = (data.get("name") or "").strip()
            if name:
                ingredient = Ingredient.objects.filter(name__iexact=name).first()
        save_kwargs = {
            "owner": self.request.user,
            "pack_unit": pack_unit,
            "pack_size": pack_size,
            "ingredient": ingredient,
        }
        upload = self.request.FILES.get("image")
        if upload:
            save_kwargs["image"] = upload
        serializer.save(**save_kwargs)


class MyProductsView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsShopOwner]

    def get_queryset(self):
        qs = Product.objects.filter(owner=self.request.user)
        q = self.request.query_params.get("q")
        category = self.request.query_params.get("category")
        include_hidden = self.request.query_params.get("include_hidden")
        if not (include_hidden and str(include_hidden).lower() in {"1", "true", "yes"}):
            qs = qs.filter(is_active=True)
        if q:
            qs = qs.filter(name__icontains=q)
        if category:
            qs = qs.filter(category_id=category)
        return qs


class UpdateProductView(generics.UpdateAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsShopOwner]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Product.objects.filter(owner=self.request.user)

    def perform_update(self, serializer):
        data = serializer.validated_data
        instance = serializer.instance
        unit = data.get("unit") or getattr(instance, "unit", "pcs")
        pack_unit = data.get("pack_unit") or unit
        pack_size = data.get("pack_size") if "pack_size" in data else (getattr(instance, "pack_size", 1) or 1)
        save_kwargs = {
            "pack_unit": pack_unit,
            "pack_size": pack_size,
        }
        upload = self.request.FILES.get("image")
        if upload:
            save_kwargs["image"] = upload
        serializer.save(**save_kwargs)


class DeleteProductView(generics.DestroyAPIView):
    permission_classes = [IsShopOwner]

    def get_queryset(self):
        return Product.objects.filter(owner=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
            return Response(status=204)
        except ProtectedError:
            # If linked to orders, soft-disable instead of hard delete
            instance.is_active = False
            instance.save(update_fields=["is_active"])
            return Response({"status": "deactivated", "reason": "linked_orders"}, status=200)


class PublicProductListView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Product.objects.filter(is_active=True)
        q = self.request.query_params.get("q")
        category = self.request.query_params.get("category")
        location = self.request.query_params.get("location")
        if q:
            qs = qs.filter(name__icontains=q)
        if category:
            qs = qs.filter(category_id=category)
        if location:
            qs = qs.filter(owner__userprofile__location__icontains=location)
        return qs


class CategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = CategorySerializer
    permission_classes = [IsShopOwner]
    queryset = Category.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]


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

    profile = UserProfile.objects.filter(user=request.user).first()
    if not profile or not (profile.address and profile.location):
        return Response({"error": "profile_incomplete"}, status=400)

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
    profile = UserProfile.objects.filter(user=request.user).first()
    if not profile or not (profile.address and profile.location):
        return Response({"error": "profile_incomplete"}, status=400)
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
            StockMovement.objects.create(
                product=p,
                change=-int(ci.quantity),
                reason="SALE",
                note=f"Order #{order.id} placed",
                created_by=request.user,
            )

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

    _notify(
        request.user,
        "Order placed",
        f"Your order #{order.id} has been placed. Receipt is ready to download.",
        type="order",
        data={"order_id": order.id, "status": order.status, "receipt": True},
    )

    return Response(OrderSerializer(order).data, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_order(request, order_id):
    with transaction.atomic():
        order = Order.objects.select_for_update().filter(id=order_id, user=request.user).first()
        if not order:
            return Response({"error": "Order not found"}, status=404)

        if order.status not in {"PLACED", "CONFIRMED"}:
            return Response({"error": f"Cannot cancel in status {order.status}"}, status=400)

        for oi in OrderItem.objects.filter(order=order):
            Product.objects.filter(id=oi.product_id).update(stock_quantity=F("stock_quantity") + oi.quantity)

        order.status = "CANCELLED"
        order.cancelled_at = timezone.now()
        order.save(update_fields=["status", "cancelled_at"])

    _notify(
        request.user,
        "Order cancelled",
        f"Your order #{order.id} has been cancelled.",
        type="order",
        data={"order_id": order.id, "status": order.status},
    )

    return Response(OrderSerializer(order).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_delivered(request, order_id):
    order = Order.objects.filter(id=order_id, user=request.user).first()
    if not order:
        return Response({"error": "Order not found"}, status=404)
    if order.status not in {"PLACED", "CONFIRMED", "OUT_FOR_DELIVERY"}:
        return Response({"error": f"Cannot deliver in status {order.status}"}, status=400)

    order.status = "DELIVERED"
    order.delivered_at = timezone.now()
    order.needs_pantry_confirm = True
    order.save(update_fields=["status", "delivered_at", "needs_pantry_confirm"])

    _notify(
        request.user,
        "Order delivered",
        f"Your order #{order.id} is marked as delivered.",
        type="delivery",
        data={"order_id": order.id, "status": order.status},
    )
    return Response(OrderSerializer(order).data)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_orders(request):
    orders = Order.objects.filter(user=request.user).order_by("-created_at")
    status = request.query_params.get("status")
    q = request.query_params.get("q")
    if status:
        orders = orders.filter(status=status)
    if q:
        q = q.strip()
        if q.isdigit():
            orders = orders.filter(id=int(q))
    return Response(OrderSerializer(orders, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def order_detail(request, order_id):
    order = Order.objects.filter(id=order_id, user=request.user).first()
    if not order:
        return Response({"error": "Order not found"}, status=404)
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

        if order.status not in {"DELIVERED", "PLACED"}:
            return Response({"error": "Order not awaiting pantry confirmation"}, status=400)

        if order.status == "PLACED":
            order.status = "DELIVERED"
            order.delivered_at = timezone.now()
            order.needs_pantry_confirm = True

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
                source_unit = (oi.pack_unit or oi.unit or p.unit)
                if source_unit == "pack":
                    source_unit = (oi.unit or p.unit)
                if not ing:
                    existing = Ingredient.objects.filter(name__iexact=p.name).first()
                    if existing:
                        ing = existing
                    else:
                        inferred_unit = _normalize_unit_key(source_unit)
                        if inferred_unit in {"kg", "grams"}:
                            default_unit = "grams"
                        elif inferred_unit in {"l", "ml"}:
                            default_unit = "ml"
                        elif inferred_unit == "pcs":
                            default_unit = "pcs"
                        else:
                            skipped.append({"product": p.name, "reason": "ingredient missing and unit unknown"})
                            continue
                        ing = Ingredient.objects.create(
                            name=p.name,
                            category="Other",
                            default_unit=default_unit
                        )
                    p.ingredient = ing
                    p.save(update_fields=["ingredient"])

                total_amount = float(oi.quantity) * float(oi.pack_size or 1)
                converted = convert_to_default_unit(
                    total_amount,
                    source_unit,
                    ing.default_unit
                )

                if converted is None:
                    skipped.append({
                        "product": p.name,
                        "ingredient": ing.name,
                        "reason": f"unit mismatch (pack_unit={oi.pack_unit}, unit={oi.unit}, ingredient.default_unit={ing.default_unit})"
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

    _notify(
        request.user,
        "Pantry updated",
        f"Items from order #{order.id} were added to your pantry.",
        type="system",
        data={"order_id": order.id, "status": order.status},
    )

    return Response({
        "status": "ok",
        "order_id": order.id,
        "applied": applied,
        "skipped": skipped
    }, status=200)


# ----------------------------
# SHOP OWNER ORDER APIs
# ----------------------------
@api_view(["GET"])
@permission_classes([IsShopOwner])
def owner_orders(request):
    orders = Order.objects.filter(items__product__owner=request.user).distinct().order_by("-created_at")
    status = request.query_params.get("status")
    q = request.query_params.get("q")
    if status:
        orders = orders.filter(status=status)
    if q:
        q = q.strip()
        if q.isdigit():
            orders = orders.filter(id=int(q))
        else:
            orders = orders.filter(Q(user__email__icontains=q) | Q(user__username__icontains=q))
    return Response(OrderSerializer(orders, many=True).data)


@api_view(["GET"])
@permission_classes([IsShopOwner])
def owner_order_detail(request, order_id):
    order = Order.objects.filter(id=order_id, items__product__owner=request.user).distinct().first()
    if not order:
        return Response({"error": "Order not found"}, status=404)
    return Response(OrderSerializer(order).data)


@api_view(["POST"])
@permission_classes([IsShopOwner])
def owner_update_order_status(request, order_id):
    new_status = request.data.get("status")
    allowed = {"CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"}
    if new_status not in allowed:
        return Response({"error": "Invalid status"}, status=400)

    order = Order.objects.filter(id=order_id, items__product__owner=request.user).distinct().first()
    if not order:
        return Response({"error": "Order not found"}, status=404)

    # Ensure the order only contains items from this shop (simplified constraint)
    other_shop_items = OrderItem.objects.filter(order=order).exclude(product__owner=request.user).exists()
    if other_shop_items:
        return Response({"error": "Order contains items from multiple shops"}, status=400)

    order.status = new_status
    if new_status == "DELIVERED":
        order.delivered_at = timezone.now()
        order.needs_pantry_confirm = True
    order.save(update_fields=["status", "delivered_at", "needs_pantry_confirm"])

    _notify(
        order.user,
        f"Order {new_status.replace('_', ' ').title()}",
        f"Your order #{order.id} is now {new_status.replace('_', ' ').lower()}.",
        type="delivery",
        data={"order_id": order.id, "status": order.status},
    )
    return Response(OrderSerializer(order).data)


@api_view(["POST"])
@permission_classes([IsShopOwner])
def owner_cancel_order(request, order_id):
    reason = request.data.get("reason", "")
    with transaction.atomic():
        order = Order.objects.select_for_update().filter(id=order_id, items__product__owner=request.user).distinct().first()
        if not order:
            return Response({"error": "Order not found"}, status=404)

        if order.status not in {"PLACED", "CONFIRMED", "PACKED"}:
            return Response({"error": f"Cannot cancel in status {order.status}"}, status=400)

        for oi in OrderItem.objects.filter(order=order):
            Product.objects.filter(id=oi.product_id).update(stock_quantity=F("stock_quantity") + oi.quantity)
            StockMovement.objects.create(
                product_id=oi.product_id,
                change=int(oi.quantity),
                reason="RESTOCK",
                note=f"Order #{order.id} cancelled by customer",
                created_by=request.user,
            )
            StockMovement.objects.create(
                product_id=oi.product_id,
                change=int(oi.quantity),
                reason="RESTOCK",
                note=f"Order #{order.id} cancelled",
                created_by=request.user,
            )

        order.status = "CANCELLED"
        order.cancelled_at = timezone.now()
        order.cancellation_reason = reason
        order.save(update_fields=["status", "cancelled_at", "cancellation_reason"])

    _notify(
        order.user,
        "Order cancelled",
        f"Your order #{order.id} has been cancelled.",
        type="order",
        data={"order_id": order.id, "status": order.status},
    )
    return Response(OrderSerializer(order).data)


@api_view(["POST"])
@permission_classes([IsShopOwner])
def owner_refund_order(request, order_id):
    reason = request.data.get("reason", "")
    with transaction.atomic():
        order = Order.objects.select_for_update().filter(id=order_id, items__product__owner=request.user).distinct().first()
        if not order:
            return Response({"error": "Order not found"}, status=404)
        if order.status not in {"DELIVERED", "COMPLETED"}:
            return Response({"error": f"Cannot refund in status {order.status}"}, status=400)

        for oi in OrderItem.objects.filter(order=order):
            Product.objects.filter(id=oi.product_id).update(stock_quantity=F("stock_quantity") + oi.quantity)
            StockMovement.objects.create(
                product_id=oi.product_id,
                change=int(oi.quantity),
                reason="REFUND",
                note=f"Order #{order.id} refunded",
                created_by=request.user,
            )

        order.status = "REFUNDED"
        order.refunded_at = timezone.now()
        order.refund_reason = reason
        order.save(update_fields=["status", "refunded_at", "refund_reason"])

    _notify(
        order.user,
        "Order refunded",
        f"Your order #{order.id} has been refunded.",
        type="order",
        data={"order_id": order.id, "status": order.status},
    )
    return Response(OrderSerializer(order).data)


@api_view(["GET", "PATCH"])
@permission_classes([IsShopOwner])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def owner_shop_profile(request):
    profile, _ = ShopProfile.objects.get_or_create(owner=request.user)
    if request.method == "GET":
        return Response(ShopProfileSerializer(profile).data)

    serializer = ShopProfileSerializer(profile, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsShopOwner])
def owner_stock_history(request):
    product_id = request.query_params.get("product_id")
    qs = StockMovement.objects.filter(product__owner=request.user).select_related("product").order_by("-created_at")
    if product_id:
        qs = qs.filter(product_id=product_id)
    return Response(StockMovementSerializer(qs[:200], many=True).data)


@api_view(["POST"])
@permission_classes([IsShopOwner])
def owner_stock_adjust(request):
    product_id = request.data.get("product_id")
    change = int(request.data.get("change", 0))
    reason = request.data.get("reason", "ADJUSTMENT")
    note = request.data.get("note", "")
    if not product_id or change == 0:
        return Response({"error": "product_id and non-zero change required"}, status=400)

    product = Product.objects.filter(id=product_id, owner=request.user).first()
    if not product:
        return Response({"error": "Product not found"}, status=404)

    product.stock_quantity = max(0, int(product.stock_quantity) + change)
    product.save(update_fields=["stock_quantity"])
    StockMovement.objects.create(
        product=product,
        change=change,
        reason=reason if reason in dict(StockMovement.REASONS) else "ADJUSTMENT",
        note=note,
        created_by=request.user,
    )
    return Response(ProductSerializer(product).data)


@api_view(["POST"])
@permission_classes([IsShopOwner])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def owner_bulk_stock_upload(request):
    upload = request.FILES.get("file")
    if not upload:
        return Response({"error": "CSV file missing"}, status=400)

    decoded = upload.read().decode("utf-8").splitlines()
    reader = csv.DictReader(decoded)
    updated = []
    skipped = []
    for idx, row in enumerate(reader, start=1):
        product_id = row.get("product_id") or row.get("id")
        name = row.get("name")
        new_stock = row.get("stock_quantity") or row.get("new_stock")
        change = row.get("change")
        note = row.get("note", "")

        product = None
        if product_id and str(product_id).isdigit():
            product = Product.objects.filter(id=int(product_id), owner=request.user).first()
        elif name:
            product = Product.objects.filter(owner=request.user, name__iexact=name.strip()).first()

        if not product:
            skipped.append({"row": idx, "reason": "product_not_found", "name": name})
            continue

        if new_stock is not None and str(new_stock).strip() != "":
            try:
                new_stock_val = int(float(new_stock))
            except ValueError:
                skipped.append({"row": idx, "reason": "invalid_stock", "name": product.name})
                continue
            change_val = new_stock_val - int(product.stock_quantity)
            product.stock_quantity = max(0, new_stock_val)
        elif change is not None and str(change).strip() != "":
            try:
                change_val = int(float(change))
            except ValueError:
                skipped.append({"row": idx, "reason": "invalid_change", "name": product.name})
                continue
            product.stock_quantity = max(0, int(product.stock_quantity) + change_val)
        else:
            skipped.append({"row": idx, "reason": "no_stock_value", "name": product.name})
            continue

        product.save(update_fields=["stock_quantity"])
        StockMovement.objects.create(
            product=product,
            change=change_val,
            reason="BULK",
            note=note or "Bulk upload",
            created_by=request.user,
        )
        updated.append({"product": product.name, "stock_quantity": product.stock_quantity})

    return Response({"updated": updated, "skipped": skipped})


@api_view(["GET"])
@permission_classes([IsShopOwner])
def owner_analytics(request):
    today = timezone.localdate()
    default_from = today - timedelta(days=29)

    date_from = _parse_date(request.query_params.get("date_from")) or default_from
    date_to = _parse_date(request.query_params.get("date_to")) or today
    if date_from > date_to:
        return Response({"error": "date_from must be <= date_to"}, status=400)

    payload = _owner_analytics_payload(request.user, date_from, date_to)
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsShopOwner])
def owner_analytics_export(request):
    today = timezone.localdate()
    default_from = today - timedelta(days=29)

    date_from = _parse_date(request.query_params.get("date_from")) or default_from
    date_to = _parse_date(request.query_params.get("date_to")) or today
    if date_from > date_to:
        return Response({"error": "date_from must be <= date_to"}, status=400)

    data = _owner_analytics_payload(request.user, date_from, date_to)

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="shop_owner_analytics_{date_from}_{date_to}.csv"'
    writer = csv.writer(response)

    summary = data["summary"]
    writer.writerow(["Shop Owner Analytics"])
    writer.writerow(["Date From", data["date_range"]["from"]])
    writer.writerow(["Date To", data["date_range"]["to"]])
    writer.writerow([])
    writer.writerow(["Summary"])
    writer.writerow(["Total Revenue", summary["total_revenue"]])
    writer.writerow(["Total Orders", summary["total_orders"]])
    writer.writerow(["Items Sold", summary["total_items_sold"]])
    writer.writerow(["Avg Order Value", summary["avg_order_value"]])
    writer.writerow(["Delivered Orders", summary["delivered_orders"]])
    writer.writerow(["Low Stock Count", summary["low_stock_count"]])
    writer.writerow(["Out Of Stock Count", summary["out_of_stock_count"]])
    writer.writerow([])

    writer.writerow(["Sales by Day"])
    writer.writerow(["Date", "Revenue", "Orders", "Items"])
    for row in data["sales_by_day"]:
        writer.writerow([row["date"], row["revenue"], row["orders"], row["items"]])
    writer.writerow([])

    writer.writerow(["Top Products"])
    writer.writerow(["Product ID", "Name", "Units Sold", "Revenue", "Stock", "Low Stock Threshold", "Low Stock"])
    for row in data["top_products"]:
        writer.writerow([
            row["product_id"],
            row["name"],
            row["units_sold"],
            row["revenue"],
            row["stock_quantity"],
            row["low_stock_threshold"],
            "YES" if row["low_stock"] else "NO",
        ])
    writer.writerow([])

    writer.writerow(["Low Stock Alerts"])
    writer.writerow(["Product ID", "Name", "Stock", "Threshold", "Out Of Stock"])
    for row in data["low_stock_alerts"]:
        writer.writerow([
            row["product_id"],
            row["name"],
            row["stock_quantity"],
            row["low_stock_threshold"],
            "YES" if row["is_out_of_stock"] else "NO",
        ])

    return response


# ----------------------------
# ADMIN ORDER APIs (read-only)
# ----------------------------
@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_orders(request):
    orders = Order.objects.all().order_by("-created_at")
    status = request.query_params.get("status")
    q = request.query_params.get("q")
    if status:
        orders = orders.filter(status=status)
    if q:
        q = q.strip()
        if q.isdigit():
            orders = orders.filter(id=int(q))
        else:
            orders = orders.filter(Q(user__email__icontains=q) | Q(user__username__icontains=q))
    return Response(OrderSerializer(orders, many=True).data)


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_order_detail(request, order_id):
    order = Order.objects.filter(id=order_id).first()
    if not order:
        return Response({"error": "Order not found"}, status=404)
    return Response(OrderSerializer(order).data)


# ----------------------------
# FEEDBACK APIs
# ----------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_feedback(request):
    order_id = request.data.get("order_id")
    rating = int(request.data.get("rating", 5))
    title = request.data.get("title", "")
    message = request.data.get("message", "").strip()

    if not message:
        return Response({"error": "Message is required"}, status=400)

    order = None
    shop_owner = None
    if order_id:
        order = Order.objects.filter(id=order_id, user=request.user).first()
        if not order:
            return Response({"error": "Order not found"}, status=404)
        first_item = OrderItem.objects.select_related("product", "product__owner").filter(order=order).first()
        if first_item:
            shop_owner = first_item.product.owner

    if not shop_owner:
        return Response({"error": "Shop not found for feedback"}, status=400)

    feedback = Feedback.objects.create(
        user=request.user,
        shop_owner=shop_owner,
        order=order,
        rating=max(1, min(5, rating)),
        title=title,
        message=message,
        status="OPEN",
    )
    return Response(FeedbackSerializer(feedback).data, status=201)


@api_view(["GET"])
@permission_classes([IsShopOwner])
def owner_feedback(request):
    qs = Feedback.objects.filter(shop_owner=request.user).order_by("-created_at")
    status_filter = request.query_params.get("status")
    if status_filter:
        qs = qs.filter(status=status_filter)
    return Response(FeedbackSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_feedback(request):
    qs = Feedback.objects.all().order_by("-created_at")
    status_filter = request.query_params.get("status")
    if status_filter:
        qs = qs.filter(status=status_filter)
    return Response(FeedbackSerializer(qs, many=True).data)


@api_view(["PATCH"])
@permission_classes([IsAdmin])
def admin_feedback_update(request, feedback_id):
    feedback = Feedback.objects.filter(id=feedback_id).first()
    if not feedback:
        return Response({"error": "Feedback not found"}, status=404)
    status_value = request.data.get("status")
    if status_value in {"OPEN", "RESOLVED", "HIDDEN"}:
        feedback.status = status_value
        feedback.save(update_fields=["status"])
    return Response(FeedbackSerializer(feedback).data)
