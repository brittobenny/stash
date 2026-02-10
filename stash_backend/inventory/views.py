from django.db import transaction, models
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import Ingredient, PantryItem
from .serializers import PantryItemSerializer
from .models import InventoryItem, Ingredient
from .serializers import InventoryItemSerializer
from .ml.recommender import recommender

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_pantry_item(request):

    ingredient_id = request.data.get("ingredient")
    quantity = float(request.data.get("quantity"))
    expiry_date = request.data.get("expiry_date")

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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recommend_meals(request):

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

    allow_partial = bool(request.data.get("allow_partial", False))

    # Get pantry names for recommendations
    pantry_items = PantryItem.objects.select_related("ingredient").filter(user=request.user)
    pantry_names = [p.ingredient.name.lower() for p in pantry_items]

    # Get recipe from current recommendations
    recs = recommender.recommend(pantry_names, top_k=20)
    recipe = next((r for r in recs if int(r["id"]) == int(recipe_id)), None)

    if not recipe:
        return Response({"error": "Recipe not found in current recommendations"}, status=status.HTTP_404_NOT_FOUND)

    parsed_ingredients = recipe.get("parsed_ingredients", [])
    if not parsed_ingredients:
        return Response({"error": "No parsed_ingredients found for this recipe"}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        # Lock pantry rows
        locked_pantry = {
            p.ingredient.name.lower(): p
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

        PantryItem.objects.filter(user=request.user, quantity__lte=0.0001).delete()

    return Response(
        {
            "status": "partial" if insufficient else "success",
            "allow_partial": allow_partial,
            "cooked_recipe": {"id": recipe["id"], "name": recipe["name"]},
            "deducted": deducted,
            "missing": insufficient
        },
        status=status.HTTP_200_OK
    )