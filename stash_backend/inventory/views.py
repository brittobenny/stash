from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
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

    ingredients = [item.ingredient.name for item in pantry_items]

    results = recommender.recommend(ingredients)

    return Response({
        "pantry_items": ingredients,
        "recommendations": results
    })
