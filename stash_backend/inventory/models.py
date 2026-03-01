from django.db import models
from django.conf import settings
import logging


logger = logging.getLogger(__name__)

# -------------------------
# MASTER INGREDIENT TABLE
# -------------------------
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
    default_unit = models.CharField(max_length=20)  # grams, ml, pcs
    image_url = models.URLField(blank=True, null=True)
    embedding = models.JSONField(null=True, blank=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.embedding and self.name:
            try:
                from inventory.ml.embedding_service import generate_embedding

                embedding = generate_embedding(self.name)
                if embedding:
                    self.embedding = embedding
            except Exception:
                # Keep writes resilient if embedding model/deps are unavailable.
                logger.exception("Ingredient embedding generation failed for '%s'.", self.name)
        super().save(*args, **kwargs)


# -------------------------
# USER PANTRY TABLE
# -------------------------
class PantryItem(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE)
    quantity = models.FloatField()
    expiry_date = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ('user', 'ingredient')

    def __str__(self):
        return f"{self.user} - {self.ingredient.name}"


class InventoryItem(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE)

    quantity = models.FloatField()
    unit = models.CharField(max_length=20)
    expiry_date = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ('user', 'ingredient')

    def __str__(self):
        return f"{self.user} - {self.ingredient.name}"
