from django.urls import path
from .views import (
    add_pantry_item,
    list_ingredients,
    get_pantry_items,
    update_pantry_item,
    recommend_meals,
    cook_recipe,
    recipe_detail,
    image_proxy,
    category_image,
    doodle_image,
    auth_background,
    add_to_inventory,
    view_inventory,
    update_inventory,
    delete_inventory
)

urlpatterns = [
    path("ingredients/", list_ingredients),
    path("pantry/add/", add_pantry_item),
    path("pantry/", get_pantry_items),
    path("pantry/update/<int:pk>/", update_pantry_item),
    path("inventory/add/", add_to_inventory),
    path("inventory/", view_inventory),
    path("inventory/update/<int:pk>/", update_inventory),
    path("inventory/delete/<int:pk>/", delete_inventory),
    path("recommend/", recommend_meals),
    path("recipes/<int:recipe_id>/", recipe_detail),
    path("cook/", cook_recipe),
    path("image-proxy/", image_proxy),
    path("category-image/<str:category>/", category_image),
    path("doodle/", doodle_image),
    path("auth-background/", auth_background),
]
