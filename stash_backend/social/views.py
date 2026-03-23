from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count
from django.db.models.functions import TruncDate
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from shop.permissions import IsAdmin
from .models import RecipePost, RecipeLike, RecipeComment
from .serializers import RecipePostSerializer, RecipeCommentSerializer


def _is_admin(user):
    return user.is_superuser or getattr(getattr(user, "userprofile", None), "role", "") == "admin"


class FeedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = RecipePost.objects.filter(status="APPROVED").select_related("user").order_by("-created_at")
        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = max(1, int(request.query_params.get("page_size", 12)))
        except Exception:
            page, page_size = 1, 12
        start = (page - 1) * page_size
        end = start + page_size
        serializer = RecipePostSerializer(qs[start:end], many=True, context={"request": request})
        return Response({
            "results": serializer.data,
            "count": qs.count(),
            "page": page,
            "page_size": page_size,
        }, status=status.HTTP_200_OK)


class MyPostsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = RecipePost.objects.filter(user=request.user).order_by("-created_at")
        serializer = RecipePostSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class PostCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = RecipePostSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            post = serializer.save()
            return Response(RecipePostSerializer(post, context={"request": request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PostDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, post_id):
        post = get_object_or_404(RecipePost, id=post_id)
        if post.status != "APPROVED" and post.user_id != request.user.id and not _is_admin(request.user):
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        serializer = RecipePostSerializer(post, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, post_id):
        post = get_object_or_404(RecipePost, id=post_id)
        if post.user_id != request.user.id:
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        if post.status == "APPROVED":
            return Response({"error": "Approved posts cannot be edited."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = RecipePostSerializer(post, data=request.data, partial=True, context={"request": request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, post_id):
        post = get_object_or_404(RecipePost, id=post_id)
        if post.user_id != request.user.id and not _is_admin(request.user):
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        post.delete()
        return Response({"status": "deleted"}, status=status.HTTP_200_OK)


class LikeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id):
        post = get_object_or_404(RecipePost, id=post_id)
        if post.status != "APPROVED":
            return Response({"error": "Post not approved."}, status=status.HTTP_400_BAD_REQUEST)
        RecipeLike.objects.get_or_create(post=post, user=request.user)
        return Response({"liked": True, "likes": post.likes.count()}, status=status.HTTP_200_OK)

    def delete(self, request, post_id):
        post = get_object_or_404(RecipePost, id=post_id)
        RecipeLike.objects.filter(post=post, user=request.user).delete()
        return Response({"liked": False, "likes": post.likes.count()}, status=status.HTTP_200_OK)


class CommentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, post_id):
        post = get_object_or_404(RecipePost, id=post_id)
        if post.status != "APPROVED" and post.user_id != request.user.id and not _is_admin(request.user):
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        qs = RecipeComment.objects.filter(post=post).select_related("user")
        serializer = RecipeCommentSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, post_id):
        post = get_object_or_404(RecipePost, id=post_id)
        if post.status != "APPROVED":
            return Response({"error": "Post not approved."}, status=status.HTTP_400_BAD_REQUEST)
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"error": "Comment text required."}, status=status.HTTP_400_BAD_REQUEST)
        comment = RecipeComment.objects.create(post=post, user=request.user, text=text)
        serializer = RecipeCommentSerializer(comment, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ApprovePostView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, post_id):
        post = get_object_or_404(RecipePost, id=post_id)
        post.status = "APPROVED"
        post.rejection_reason = ""
        post.approved_by = request.user
        post.approved_at = timezone.now()
        post.save(update_fields=["status", "rejection_reason", "approved_by", "approved_at"])
        serializer = RecipePostSerializer(post, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class RejectPostView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, post_id):
        post = get_object_or_404(RecipePost, id=post_id)
        reason = (request.data.get("reason") or "").strip()
        post.status = "REJECTED"
        post.rejection_reason = reason
        post.approved_by = request.user
        post.approved_at = timezone.now()
        post.save(update_fields=["status", "rejection_reason", "approved_by", "approved_at"])
        serializer = RecipePostSerializer(post, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ReviewQueueView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        status_filter = request.query_params.get("status", "ALL")
        qs = RecipePost.objects.all().select_related("user").order_by("-created_at")
        if status_filter and status_filter != "ALL":
            qs = qs.filter(status=status_filter)
        serializer = RecipePostSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class EngagementAnalyticsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        try:
            days = max(1, min(30, int(request.query_params.get("days", 14))))
        except Exception:
            days = 14

        today = timezone.localdate()
        start_date = today - timedelta(days=days - 1)

        likes_qs = RecipeLike.objects.filter(created_at__date__gte=start_date).annotate(
            day=TruncDate("created_at")
        ).values("day").annotate(count=Count("id"))
        comments_qs = RecipeComment.objects.filter(created_at__date__gte=start_date).annotate(
            day=TruncDate("created_at")
        ).values("day").annotate(count=Count("id"))

        likes_map = {row["day"]: row["count"] for row in likes_qs}
        comments_map = {row["day"]: row["count"] for row in comments_qs}

        labels = []
        likes = []
        comments = []
        for i in range(days):
            day = start_date + timedelta(days=i)
            labels.append(day.isoformat())
            likes.append(int(likes_map.get(day, 0)))
            comments.append(int(comments_map.get(day, 0)))

        return Response({
            "days": days,
            "labels": labels,
            "likes": likes,
            "comments": comments,
        }, status=status.HTTP_200_OK)
