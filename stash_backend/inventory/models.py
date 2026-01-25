from django.db import models
from django.contrib.auth.models import User

class Ingredient(models.Model):
    CATEGORY_CHOICES = [
        ('Vegetable', 'Vegetable'),
        ('Fruit', 'Fruit'),
        ('Meat', 'Meat'),
        ('Dairy', 'Dairy'),
        ('Grain', 'Grain'),
        ('Spice', 'Spice'),
        ('Oil', 'Oil'),
        ('Other', 'Other'),
    ]

    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    default_unit = models.CharField(max_length=20)  # kg, g, ml, pcs

    def __str__(self):
        return self.name




class InventoryItem(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE)

    quantity = models.FloatField()
    unit = models.CharField(max_length=20)
    expiry_date = models.DateField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.ingredient.name} - {self.user.username}"
