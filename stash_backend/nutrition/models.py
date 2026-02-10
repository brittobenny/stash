from django.db import models

class NutritionItem(models.Model):
    name = models.CharField(max_length=255, unique=True)

    calories = models.FloatField()
    carbs = models.FloatField()
    protein = models.FloatField()
    fats = models.FloatField()
    fiber = models.FloatField(null=True, blank=True)

    def __str__(self):
        return self.name
