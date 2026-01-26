from django.urls import path
from .views import add_pantry_item
from .views import get_pantry_items


urlpatterns = [
    path("pantry/add/", add_pantry_item),
    path("pantry/", get_pantry_items),

]
