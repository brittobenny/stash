from django.conf import settings
from django.db import models

from inventory.ml.hero_ingredient_pipeline import compute_pseudo_hero, predict_hero


class Recipe(models.Model):
    title = models.CharField(max_length=255)
    ingredients = models.TextField(help_text="Comma-separated ingredient names")
    quantities = models.TextField(
        blank=True,
        default="",
        help_text="Comma-separated quantities aligned with ingredients",
    )
    hero_ingredient = models.CharField(max_length=120, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recipes_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.hero_ingredient or 'unknown'})"

    def _infer_hero_ingredient(self) -> str:
        """
        Primary path: ML inference using trained artifacts.
        Fallback path: rule-based pseudo-label logic.
        """
        try:
            return predict_hero(self.title, self.ingredients)
        except Exception:
            return compute_pseudo_hero(self.title, self.ingredients, self.quantities)

    def save(self, *args, **kwargs):
        if self.title and self.ingredients:
            self.hero_ingredient = self._infer_hero_ingredient()
        super().save(*args, **kwargs)
