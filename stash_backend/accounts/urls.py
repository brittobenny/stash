from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    ProfileView,
    NotificationListView,
    NotificationMarkReadView,
    AdminSummaryView,
    AdminUserListView,
    AdminUserUpdateView,
    AdminCreateShopOwnerView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('notifications/', NotificationListView.as_view(), name='notifications'),
    path('notifications/<str:notification_id>/', NotificationMarkReadView.as_view(), name='notification_mark_read'),
    path('admin/summary/', AdminSummaryView.as_view(), name='admin_summary'),
    path('admin/users/', AdminUserListView.as_view(), name='admin_users'),
    path('admin/users/<int:user_id>/', AdminUserUpdateView.as_view(), name='admin_user_update'),
    path('admin/shops/', AdminCreateShopOwnerView.as_view(), name='admin_create_shop'),
]
