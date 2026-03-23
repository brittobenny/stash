from django.shortcuts import render
from django.db import models
from django.conf import settings
from django.core.mail import send_mail
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from .serializers import RegisterSerializer, ProfileSerializer, NotificationSerializer
from .models import UserProfile, Notification
from shop.models import ShopProfile
from shop.permissions import IsAdmin
from shop.models import Order


def _send_welcome_email(user) -> None:
    recipient = str(getattr(user, "email", "") or "").strip()
    if not recipient:
        return

    display_name = str(getattr(user, "first_name", "") or "").strip() or "there"
    message = "\n".join(
        [
            f"Hi {display_name},",
            "",
            "Welcome to Stash.",
            "Your account is ready, and you can now explore recipes, track nutrition, and shop ingredients.",
            "",
            "If you did not create this account, please ignore this email.",
        ]
    )

    try:
        send_mail(
            subject="Welcome to Stash",
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
        )
    except Exception as exc:
        print(f"Welcome email failed for {recipient}: {exc}")

class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request):
        try:
            serializer = RegisterSerializer(data=request.data)
            if serializer.is_valid():
                user = serializer.save()
                _send_welcome_email(user)
                return Response({
                    "message": "User registered successfully",
                    "user": {
                        "email": user.email,
                        "name": user.first_name
                    }
                }, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                "error": str(e),
                "type": type(e).__name__
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        
        if not email or not password:
            return Response({
                "error": "Please provide both email and password"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = authenticate(username=email, password=password)
        if user is None:
            # Allow login by email even if username isn't email
            try:
                from django.contrib.auth.models import User
                user_obj = User.objects.filter(email__iexact=email).first()
                if user_obj:
                    user = authenticate(username=user_obj.username, password=password)
            except Exception:
                user = None
        
        if user is None:
            return Response({
                "error": "Invalid credentials"
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            profile = UserProfile.objects.get(user=user)
            if user.is_superuser and profile.role != "admin":
                profile.role = "admin"
                profile.save(update_fields=["role"])
            role = profile.role
        except UserProfile.DoesNotExist:
            # Auto-create profile if missing (admin-created users)
            if user.is_superuser:
                role = "admin"
            elif user.is_staff:
                role = "shopowner"
            else:
                role = "customer"
            profile = UserProfile.objects.create(
                user=user,
                role=role,
                mobile_number=""
            )
        
        token, _ = Token.objects.get_or_create(user=user)

        profile_completed = bool(profile.address and profile.location)
        
        return Response({
            "message": "Login successful",
            "token": token.key,
            "role": role,
            "user": {
                "email": user.email,
                "name": user.first_name,
                "role": role,
                "mobile_number": profile.mobile_number,
                "address": profile.address,
                "location": profile.location,
                "image": profile.image.url if profile.image else None,
                "profile_completed": profile_completed,
            }
        }, status=status.HTTP_200_OK)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={"mobile_number": "", "role": "customer"},
        )
        if request.user.is_superuser and profile.role != "admin":
            profile.role = "admin"
            profile.save(update_fields=["role"])
        serializer = ProfileSerializer(profile)
        data = serializer.data
        data["profile_completed"] = bool(profile.address and profile.location)
        return Response(data, status=status.HTTP_200_OK)

    def patch(self, request):
        profile, _ = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={"mobile_number": "", "role": "customer"},
        )
        if request.user.is_superuser and profile.role != "admin":
            profile.role = "admin"
            profile.save(update_fields=["role"])
        data = request.data.copy()
        name = data.pop("name", None)
        serializer = ProfileSerializer(profile, data=data, partial=True)
        if serializer.is_valid():
            if name is not None:
                if isinstance(name, (list, tuple)):
                    name_value = " ".join([str(n) for n in name if n]).strip()
                else:
                    name_value = str(name).strip()
                if name_value.startswith("[") and name_value.endswith("]"):
                    name_value = name_value[1:-1]
                name_value = name_value.replace("\\", "").replace('"', "").replace("'", "").strip()
                request.user.first_name = name_value
                request.user.save(update_fields=["first_name"])
            serializer.save()
            data = serializer.data
            data["profile_completed"] = bool(profile.address and profile.location)
            return Response(data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            from inventory.expiry_alerts import sync_expiry_notifications_for_user
            from inventory.low_stock import sync_low_stock_notifications_for_user

            sync_expiry_notifications_for_user(request.user)
            sync_low_stock_notifications_for_user(request.user)
        except Exception:
            pass
        qs = Notification.objects.filter(user=request.user).order_by("-created_at")
        if request.query_params.get("unread") == "true":
            qs = qs.filter(is_read=False)
        serializer = NotificationSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id=None):
        if notification_id == "all":
            Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
            return Response({"status": "ok"}, status=status.HTTP_200_OK)
        notif = Notification.objects.filter(id=notification_id, user=request.user).first()
        if not notif:
            return Response({"error": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)
        notif.is_read = True
        notif.save(update_fields=["is_read"])
        return Response({"status": "ok"}, status=status.HTTP_200_OK)


class AdminSummaryView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        total_users = UserProfile.objects.count()
        shop_owners = UserProfile.objects.filter(role="shopowner").count()
        customers = UserProfile.objects.filter(role="customer").count()
        admins = UserProfile.objects.filter(role="admin").count()
        total_orders = Order.objects.count()
        open_orders = Order.objects.filter(status__in=["PLACED", "CONFIRMED", "OUT_FOR_DELIVERY"]).count()
        revenue = Order.objects.exclude(status__in=["CANCELLED", "REFUNDED"]).aggregate(
            total=models.Sum("total_amount")
        )["total"] or 0

        return Response({
            "total_users": total_users,
            "shop_owners": shop_owners,
            "customers": customers,
            "admins": admins,
            "total_orders": total_orders,
            "open_orders": open_orders,
            "revenue": float(revenue),
        }, status=status.HTTP_200_OK)


class AdminUserListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        role = request.query_params.get("role")
        qs = UserProfile.objects.select_related("user").all()
        if role:
            qs = qs.filter(role=role)
        data = []
        for profile in qs:
            user = profile.user
            shop_profile = None
            if profile.role == "shopowner":
                shop_profile = ShopProfile.objects.filter(owner=user).first()
            data.append({
                "id": user.id,
                "email": user.email,
                "name": user.first_name,
                "role": profile.role,
                "mobile_number": profile.mobile_number,
                "location": profile.location,
                "address": profile.address,
                "store_name": shop_profile.store_name if shop_profile else "",
                "is_active": user.is_active,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
                "date_joined": user.date_joined.isoformat() if user.date_joined else None,
                "last_login": user.last_login.isoformat() if user.last_login else None,
                "profile_completed": bool(profile.address and profile.location),
            })
        return Response(data, status=status.HTTP_200_OK)


class AdminUserUpdateView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, user_id):
        profile = UserProfile.objects.select_related("user").filter(user_id=user_id).first()
        if not profile:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        user = profile.user
        role = request.data.get("role")
        is_active = request.data.get("is_active")

        if role in {"customer", "shopowner", "admin"}:
            profile.role = role
            profile.save(update_fields=["role"])
            if role == "admin":
                user.is_staff = True
            elif role == "shopowner":
                user.is_staff = True
            else:
                user.is_staff = False
            user.save(update_fields=["is_staff"])

        if isinstance(is_active, bool):
            user.is_active = is_active
            user.save(update_fields=["is_active"])

        return Response({
            "id": user.id,
            "email": user.email,
            "name": user.first_name,
            "role": profile.role,
            "mobile_number": profile.mobile_number,
            "location": profile.location,
            "address": profile.address,
            "is_active": user.is_active,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "date_joined": user.date_joined.isoformat() if user.date_joined else None,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "profile_completed": bool(profile.address and profile.location),
        }, status=status.HTTP_200_OK)


class AdminCreateShopOwnerView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        email = (request.data.get("email") or "").strip().lower()
        password = (request.data.get("password") or "").strip()
        mobile_number = (request.data.get("mobile_number") or "").strip()
        location = (request.data.get("location") or "").strip()
        address = (request.data.get("address") or "").strip()
        store_name = (request.data.get("store_name") or name or "New Shop").strip()

        if not email or not password:
            return Response({"error": "Email and password are required."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=email).exists():
            return Response({"error": "User already exists."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=name or email.split("@")[0]
        )
        user.is_staff = True
        user.save(update_fields=["is_staff"])

        profile = UserProfile.objects.create(
            user=user,
            role="shopowner",
            mobile_number=mobile_number,
            location=location,
            address=address,
        )

        ShopProfile.objects.create(
            owner=user,
            store_name=store_name,
            address=address,
            location=location,
            phone=mobile_number,
        )

        return Response({
            "id": user.id,
            "email": user.email,
            "name": user.first_name,
            "role": profile.role,
            "mobile_number": profile.mobile_number,
            "location": profile.location,
            "address": profile.address,
            "store_name": store_name,
            "is_active": user.is_active,
        }, status=status.HTTP_201_CREATED)
