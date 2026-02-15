from django.db import transaction, models
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from .models import Ingredient, PantryItem
from .serializers import PantryItemSerializer
from .models import InventoryItem, Ingredient
from .serializers import InventoryItemSerializer
from .ml.recommender import recommender
from nutrition.calculator import calculate_nutrition
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from django.http import HttpResponse, HttpResponseRedirect, FileResponse
from django.conf import settings
from pathlib import Path

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_ingredients(request):
    ingredients = Ingredient.objects.all().values('id', 'name', 'category', 'default_unit', 'image_url')
    return Response(list(ingredients))

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_pantry_item(request):
    ingredient_id = request.data.get("ingredient")
    quantity_raw = request.data.get("quantity")
    expiry_date = request.data.get("expiry_date")

    if not ingredient_id:
        return Response({"error": "ingredient is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        quantity = float(quantity_raw)
    except (TypeError, ValueError):
        return Response({"error": "quantity must be a number"}, status=status.HTTP_400_BAD_REQUEST)

    if quantity <= 0:
        return Response({"error": "quantity must be greater than 0"}, status=status.HTTP_400_BAD_REQUEST)

    if not expiry_date:
        expiry_date = None

    pantry_item, created = PantryItem.objects.get_or_create(
        user=request.user,
        ingredient_id=ingredient_id,
        defaults={
            "quantity": quantity,
            "expiry_date": expiry_date
        }
    )

    if not created:
        pantry_item.quantity += quantity
        pantry_item.expiry_date = expiry_date
        pantry_item.save()

    return Response({"message": "Pantry updated successfully"})



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_pantry_items(request):
    items = PantryItem.objects.filter(user=request.user)
    serializer = PantryItemSerializer(items, many=True)
    return Response(serializer.data)


@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def update_pantry_item(request, pk):
    try:
        item = PantryItem.objects.get(pk=pk, user=request.user)
    except PantryItem.DoesNotExist:
        return Response({"error": "Item not found"}, status=404)

    qty_raw = request.data.get("quantity", item.quantity)
    expiry_date = request.data.get("expiry_date", item.expiry_date)

    try:
        qty = float(qty_raw)
    except (TypeError, ValueError):
        return Response({"error": "quantity must be a number"}, status=400)

    if qty <= 0:
        return Response({"error": "quantity must be greater than 0"}, status=400)

    item.quantity = qty
    item.expiry_date = expiry_date
    item.save(update_fields=["quantity", "expiry_date"])
    return Response(PantryItemSerializer(item).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_to_inventory(request):
    ingredient_id = request.data.get("ingredient")
    quantity = request.data.get("quantity")
    unit = request.data.get("unit")
    expiry_date = request.data.get("expiry_date")

    try:
        ingredient = Ingredient.objects.get(id=ingredient_id)
    except Ingredient.DoesNotExist:
        return Response({"error": "Ingredient not found"}, status=404)

    item, created = InventoryItem.objects.update_or_create(
        user=request.user,
        ingredient=ingredient,
        defaults={
            "quantity": quantity,
            "unit": unit,
            "expiry_date": expiry_date
        }
    )

    serializer = InventoryItemSerializer(item)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def view_inventory(request):
    items = InventoryItem.objects.filter(user=request.user)
    serializer = InventoryItemSerializer(items, many=True)
    return Response(serializer.data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_inventory(request, pk):
    try:
        item = InventoryItem.objects.get(pk=pk, user=request.user)
    except InventoryItem.DoesNotExist:
        return Response({"error": "Item not found"}, status=404)

    serializer = InventoryItemSerializer(item, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)

    return Response(serializer.errors, status=400)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_inventory(request, pk):
    try:
        item = InventoryItem.objects.get(pk=pk, user=request.user)
    except InventoryItem.DoesNotExist:
        return Response({"error": "Item not found"}, status=404)

    item.delete()
    return Response({"message": "Item deleted"})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def recommend_meals(request):

    if request.method == "POST":
        selected = request.data.get("ingredients") or []
        if isinstance(selected, str):
            selected = [s.strip() for s in selected.split(",")]
        ingredients = [str(item).lower() for item in selected if str(item).strip()]
    else:
        ingredients = []

    if not ingredients:
        pantry_items = PantryItem.objects.filter(user=request.user)
        ingredients = [
            item.ingredient.name.lower()
            for item in pantry_items
        ]

    results = recommender.recommend(ingredients)

    # 🔹 Attach high calorie warning
    for recipe in results:
        recipe["high_calorie_warning"] = (
            recipe["nutrition"]["calories"] > 700
        )

    return Response({
        "pantry_items": ingredients,
        "recommendations": results
    })


SUPPORTED_UNITS = {"g", "grams", "ml", "pcs", "piece"}

def normalize_name(name: str) -> str:
    n = (name or "").lower().strip()

    # remove common trailing notes
    for junk in ["- as required", "- as needed", "- to taste", "to taste", "as needed", "as required", "optional"]:
        n = n.replace(junk, "")

    n = n.replace("/", " ")
    n = " ".join(n.split())

    aliases = {
        "cloves garlic": "garlic",
        "garlic cloves": "garlic",
        "red chilli flakes": "chilli flakes",
        "red chili flakes": "chilli flakes",
    }
    return aliases.get(n, n)

def parse_bool(val) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    if isinstance(val, str):
        return val.strip().lower() in {"1", "true", "yes", "y", "on"}
    return False

def build_ingredient_status(pantry_items, parsed_ingredients):
    pantry_map = {
        normalize_name(p.ingredient.name): float(p.quantity or 0)
        for p in pantry_items
    }
    status_list = []
    for item in parsed_ingredients:
        ing_name = normalize_name(item.get("name"))
        needed = float(item.get("grams") or 0)
        have = float(pantry_map.get(ing_name, 0))
        status_list.append({
            "name": ing_name,
            "display": item.get("display") or f"{round(needed, 2)} g",
            "quantity": item.get("quantity"),
            "unit": item.get("unit"),
            "needed_g": round(needed, 2),
            "have_g": round(have, 2),
            "status": "have" if have >= needed and needed > 0 else "missing"
        })
    return status_list


@api_view(["GET"])
@permission_classes([AllowAny])
def image_proxy(request):
    url = request.query_params.get("url")
    fallback = request.query_params.get("fallback")
    safe_fallback = None

    if fallback and fallback.startswith("http"):
        fb_parsed = urlparse(fallback)
        allowed_fallback_domains = {"source.unsplash.com", "images.unsplash.com", "placehold.co"}
        if fb_parsed.netloc in allowed_fallback_domains:
            safe_fallback = fallback

    if not url or not url.startswith("http"):
        if safe_fallback:
            return HttpResponseRedirect(safe_fallback)
        return Response({"error": "Invalid url"}, status=400)

    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    if not (domain == "archanaskitchen.com" or domain.endswith(".archanaskitchen.com")):
        if safe_fallback:
            return HttpResponseRedirect(safe_fallback)
        return Response({"error": "Domain not allowed"}, status=400)

    try:
        req = Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Referer": f"{parsed.scheme}://{parsed.netloc}",
            },
        )
        with urlopen(req, timeout=8) as resp:
            content = resp.read()
            content_type = resp.headers.get("Content-Type", "image/jpeg")
            return HttpResponse(content, content_type=content_type)
    except Exception:
        if safe_fallback:
            return HttpResponseRedirect(safe_fallback)
        return Response({"error": "Failed to fetch image"}, status=502)


@api_view(["GET"])
@permission_classes([AllowAny])
def category_image(request, category):
    name = (category or "").lower().strip()
    mapping = {
        "vegetable": "vegetables.jpg",
        "vegetables": "vegetables.jpg",
        "grain": "grains.jpg",
        "grains": "grains.jpg",
        "dairy": "diary.jpg",
        "diary": "diary.jpg",
        "meat": "meat.jpg",
        "spice": "spice.jpg",
        "spices": "spice.jpg",
    }
    filename = mapping.get(name)
    if not filename:
        return Response({"error": "Category image not found"}, status=404)

    base_dir = Path(settings.BASE_DIR) / "data"
    file_path = base_dir / filename
    if not file_path.exists():
        return Response({"error": "Image file missing"}, status=404)

    return FileResponse(open(file_path, "rb"), content_type="image/jpeg")


@api_view(["GET"])
@permission_classes([AllowAny])
def doodle_image(request):
    file_path = Path(settings.BASE_DIR) / "data" / "doodle.jpg"
    if not file_path.exists():
        return Response({"error": "Doodle image missing"}, status=404)
    return FileResponse(open(file_path, "rb"), content_type="image/jpeg")


@api_view(["GET"])
@permission_classes([AllowAny])
def auth_background(request):
    file_path = Path(settings.BASE_DIR) / "data" / "background.jpg"
    if not file_path.exists():
        return Response({"error": "Background image missing"}, status=404)
    return FileResponse(open(file_path, "rb"), content_type="image/jpeg")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recipe_detail(request, recipe_id):
    recipe = recommender.get_by_id(recipe_id)
    if not recipe:
        return Response({"error": "Recipe not found"}, status=status.HTTP_404_NOT_FOUND)

    pantry_items = PantryItem.objects.select_related("ingredient").filter(user=request.user)
    status_list = build_ingredient_status(pantry_items, recipe.get("parsed_ingredients", []))

    pantry_names = [normalize_name(p.ingredient.name) for p in pantry_items]
    recipe_set = set(recipe.get("ingredients_set", []))
    pantry_set = set(pantry_names)

    recipe["available_ingredients"] = sorted(list(pantry_set & recipe_set))
    recipe["missing_ingredients"] = sorted(list(recipe_set - pantry_set))
    recipe["ingredient_status"] = status_list

    return Response(recipe)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cook_recipe(request):
    """
    Body:
    {
      "recipe_id": 961,
      "allow_partial": true   // optional (default false)
    }
    """
    recipe_id = request.data.get("recipe_id")
    if recipe_id is None:
        return Response({"error": "recipe_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    allow_partial = parse_bool(request.data.get("allow_partial", False))

    pantry_items = PantryItem.objects.select_related("ingredient").filter(user=request.user)
    pantry_names = [normalize_name(p.ingredient.name) for p in pantry_items]

    recipe = recommender.get_by_id(recipe_id)
    if not recipe:
        return Response({"error": "Recipe not found"}, status=status.HTTP_404_NOT_FOUND)

    override_ingredients = request.data.get("ingredients")
    if override_ingredients:
        parsed_ingredients = []
        for item in override_ingredients:
            try:
                name = str(item.get("name") or "")
                grams = float(item.get("grams") or 0)
            except Exception:
                continue
            if not name or grams <= 0:
                continue
            parsed_ingredients.append({"name": name, "grams": grams})
    else:
        parsed_ingredients = recipe.get("parsed_ingredients", [])

    if not parsed_ingredients:
        return Response({"error": "No parsed_ingredients found for this recipe"}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        # Lock pantry rows
        locked_pantry = {
            normalize_name(p.ingredient.name): p
            for p in PantryItem.objects.select_for_update().select_related("ingredient").filter(user=request.user)
        }

        # -------------------------
        # PASS 1: CHECK ONLY
        # -------------------------
        insufficient = []
        plan = []  # (pantry_obj, amount_to_use)

        for item in parsed_ingredients:
            ing_name = normalize_name(item.get("name"))
            needed = float(item.get("grams") or 0)

            if not ing_name or needed <= 0:
                continue

            pantry_obj = locked_pantry.get(ing_name)
            have = float(pantry_obj.quantity) if pantry_obj else 0.0

            if have <= 0:
                insufficient.append({"ingredient": ing_name, "needed": needed, "have": have})
                continue

            if have < needed:
                insufficient.append({"ingredient": ing_name, "needed": needed, "have": have})
                if allow_partial:
                    plan.append((pantry_obj, have))  # use whatever is available
                # if strict -> do nothing
                continue

            # have >= needed
            plan.append((pantry_obj, needed))

        # STRICT MODE: if anything missing, do NOT deduct
        if insufficient and not allow_partial:
            return Response(
                {"status": "failed", "reason": "insufficient_pantry", "insufficient": insufficient},
                status=status.HTTP_400_BAD_REQUEST
            )

        # -------------------------
        # PASS 2: DEDUCT (allowed)
        # -------------------------
        deducted = []
        for pantry_obj, use_amt in plan:
            if pantry_obj is None or use_amt <= 0:
                continue
            pantry_obj.quantity = float(pantry_obj.quantity) - float(use_amt)
            pantry_obj.save(update_fields=["quantity"])
            deducted.append({"ingredient": pantry_obj.ingredient.name, "used_g": float(use_amt)})

            inv_item, _ = InventoryItem.objects.get_or_create(
                user=request.user,
                ingredient=pantry_obj.ingredient,
                defaults={"quantity": 0, "unit": pantry_obj.ingredient.default_unit}
            )
            inv_item.quantity = float(inv_item.quantity or 0) + float(use_amt)
            inv_item.unit = pantry_obj.ingredient.default_unit
            inv_item.save(update_fields=["quantity", "unit"])

        PantryItem.objects.filter(user=request.user, quantity__lte=0.0001).delete()

    return Response(
        {
            "status": "partial" if insufficient else "success",
            "allow_partial": allow_partial,
            "cooked_recipe": {"id": recipe["id"], "name": recipe["name"]},
            "deducted": deducted,
            "missing": insufficient,
            "nutrition": calculate_nutrition(parsed_ingredients)
        },
        status=status.HTTP_200_OK
    )
