from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from .serializers import RegisterSerializer
from .models import UserProfile

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
            role = profile.role
        except UserProfile.DoesNotExist:
            # Auto-create profile if missing (admin-created users)
            role = "shopowner" if user.is_staff else "customer"
            profile = UserProfile.objects.create(
                user=user,
                role=role,
                mobile_number=""
            )
        
        token, _ = Token.objects.get_or_create(user=user)
        
        return Response({
            "message": "Login successful",
            "token": token.key,
            "user": {
                "email": user.email,
                "name": user.first_name,
                "role": role,
                "mobile_number": profile.mobile_number
            }
        }, status=status.HTTP_200_OK)
