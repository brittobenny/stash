from django.urls import path
from .views import (
    FeedView,
    MyPostsView,
    PostCreateView,
    PostDetailView,
    LikeView,
    CommentListCreateView,
    ApprovePostView,
    RejectPostView,
    ReviewQueueView,
)

urlpatterns = [
    path("feed/", FeedView.as_view(), name="social-feed"),
    path("mine/", MyPostsView.as_view(), name="social-mine"),
    path("posts/", PostCreateView.as_view(), name="social-create"),
    path("posts/<int:post_id>/", PostDetailView.as_view(), name="social-detail"),
    path("posts/<int:post_id>/like/", LikeView.as_view(), name="social-like"),
    path("posts/<int:post_id>/comments/", CommentListCreateView.as_view(), name="social-comments"),
    path("posts/<int:post_id>/approve/", ApprovePostView.as_view(), name="social-approve"),
    path("posts/<int:post_id>/reject/", RejectPostView.as_view(), name="social-reject"),
    path("review/", ReviewQueueView.as_view(), name="social-review"),
]
