from django.db import models
from django.contrib.auth.models import User


class RecipePost(models.Model):
    STATUS_CHOICES = [
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
        ("PENDING", "Pending"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="recipe_posts")
    title = models.CharField(max_length=200)
    caption = models.TextField(blank=True)
    ingredients = models.TextField(blank=True)
    steps = models.TextField(blank=True)
    image = models.ImageField(upload_to="recipe_posts/", blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="APPROVED")
    rejection_reason = models.TextField(blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_recipe_posts")
    approved_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.status})"


class RecipeLike(models.Model):
    post = models.ForeignKey(RecipePost, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="recipe_likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("post", "user")


class RecipeComment(models.Model):
    post = models.ForeignKey(RecipePost, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="recipe_comments")
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
