from django.contrib import admin
from .models import UserProfile, Notification

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'mobile_number', 'location']
    list_filter = ['role']
    search_fields = ['user__username', 'user__email', 'mobile_number']


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'title', 'type', 'is_read', 'created_at']
    list_filter = ['type', 'is_read']
    search_fields = ['user__email', 'title', 'message']
