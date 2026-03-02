from rest_framework import serializers
from .models import RecipePost, RecipeLike, RecipeComment


class RecipePostSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_image = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = RecipePost
        fields = [
            "id",
            "title",
            "caption",
            "ingredients",
            "steps",
            "image",
            "status",
            "rejection_reason",
            "created_at",
            "author_name",
            "author_image",
            "like_count",
            "comment_count",
            "is_liked",
        ]
        read_only_fields = [
            "status",
            "rejection_reason",
            "created_at",
            "author_name",
            "author_image",
            "like_count",
            "comment_count",
            "is_liked",
        ]

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request else None
        return RecipePost.objects.create(user=user, status="APPROVED", **validated_data)

    def get_author_name(self, obj):
        return obj.user.first_name or obj.user.username or obj.user.email

    def get_author_image(self, obj):
        try:
            profile = obj.user.userprofile
            if profile.image:
                request = self.context.get("request")
                if request:
                    return request.build_absolute_uri(profile.image.url)
                return profile.image.url
        except Exception:
            return None
        return None

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_comment_count(self, obj):
        return obj.comments.count()

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.likes.filter(user=request.user).exists()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if request and data.get("image") and not str(data["image"]).startswith("http"):
            data["image"] = request.build_absolute_uri(data["image"])
        if request:
            user = request.user
            is_admin = user.is_superuser or getattr(getattr(user, "userprofile", None), "role", "") == "admin"
            is_owner = instance.user_id == user.id
            if not (is_owner or is_admin):
                data["rejection_reason"] = ""
                if instance.status != "APPROVED":
                    data["status"] = "APPROVED"
        return data


class RecipeCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_image = serializers.SerializerMethodField()

    class Meta:
        model = RecipeComment
        fields = ["id", "text", "created_at", "author_name", "author_image"]

    def get_author_name(self, obj):
        return obj.user.first_name or obj.user.username or obj.user.email

    def get_author_image(self, obj):
        try:
            profile = obj.user.userprofile
            if profile.image:
                request = self.context.get("request")
                if request:
                    return request.build_absolute_uri(profile.image.url)
                return profile.image.url
        except Exception:
            return None
        return None
