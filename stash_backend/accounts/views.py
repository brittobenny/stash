from django.shortcuts import render
from django.db import models
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from .serializers import RegisterSerializer, ProfileSerializer, NotificationSerializer
from .models import UserProfile, Notification
from shop.permissions import IsAdmin
from shop.models import Order

class RegisterView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        try:
            serializer = RegisterSerializer(data=request.data)
            if serializer.is_valid():
                user = serializer.save()
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
                "profile_completed": profile_completed,
            }
        }, status=status.HTTP_200_OK)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

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
        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            name = request.data.get("name")
            if name is not None:
                request.user.first_name = name
                request.user.save(update_fields=["first_name"])
            serializer.save()
            data = serializer.data
            data["profile_completed"] = bool(profile.address and profile.location)
            return Response(data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
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
            data.append({
                "id": user.id,
                "email": user.email,
                "name": user.first_name,
                "role": profile.role,
                "mobile_number": profile.mobile_number,
                "location": profile.location,
                "is_active": user.is_active,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
            })
        return Response(data, status=status.HTTP_200_OK)
