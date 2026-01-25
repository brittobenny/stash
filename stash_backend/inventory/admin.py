from django.contrib import admin
from .models import Ingredient, InventoryItem

admin.site.register(Ingredient)
admin.site.register(InventoryItem)
