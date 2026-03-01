from django.urls import path

from .views import RecipeDetailView, RecipeListCreateView


urlpatterns = [
    path("recipes/", RecipeListCreateView.as_view(), name="recipe_list_create"),
    path("recipes/<int:pk>/", RecipeDetailView.as_view(), name="recipe_detail"),
]
