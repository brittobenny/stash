from django.urls import path
from .views import add_pantry_item
from .views import get_pantry_items
from .views import recommend_meals
from .views import (
    add_to_inventory,
    view_inventory,
    update_inventory,
    delete_inventory
)

urlpatterns = [
    path("pantry/add/", add_pantry_item),
    path("pantry/", get_pantry_items),
    path("inventory/add/", add_to_inventory),
    path("inventory/", view_inventory),
    path("inventory/update/<int:pk>/", update_inventory),
    path("inventory/delete/<int:pk>/", delete_inventory),
    path("recommend/", recommend_meals),
]
