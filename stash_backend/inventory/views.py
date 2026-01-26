from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Ingredient, PantryItem
from .serializers import PantryItemSerializer

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