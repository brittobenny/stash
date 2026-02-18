from rest_framework.permissions import BasePermission

class IsShopOwner(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            hasattr(request.user, "userprofile") and
            request.user.userprofile.role == "shopowner"
        )


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            (
                request.user.is_superuser or
                (hasattr(request.user, "userprofile") and request.user.userprofile.role == "admin")
            )
        )
