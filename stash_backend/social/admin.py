from django.contrib import admin
from django.utils import timezone
from .models import RecipePost, RecipeLike, RecipeComment


@admin.register(RecipePost)
class RecipePostAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "user", "status", "created_at", "approved_at")
    list_filter = ("status", "created_at")
    search_fields = ("title", "user__username", "user__email")
    actions = ["approve_posts", "reject_posts"]

    def approve_posts(self, request, queryset):
        queryset.update(status="APPROVED", approved_by=request.user, approved_at=timezone.now(), rejection_reason="")

    def reject_posts(self, request, queryset):
        queryset.update(status="REJECTED", approved_by=request.user, approved_at=timezone.now())


@admin.register(RecipeLike)
class RecipeLikeAdmin(admin.ModelAdmin):
    list_display = ("id", "post", "user", "created_at")


@admin.register(RecipeComment)
class RecipeCommentAdmin(admin.ModelAdmin):
    list_display = ("id", "post", "user", "created_at")
