from rest_framework import generics, permissions
from .models import Product
from .serializers import ProductSerializer
from .permissions import IsShopOwner

# Add Product
class AddProductView(generics.CreateAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsShopOwner]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

# List My Products
class MyProductsView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsShopOwner]

    def get_queryset(self):
        return Product.objects.filter(owner=self.request.user)

# Update Product
class UpdateProductView(generics.UpdateAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsShopOwner]

    def get_queryset(self):
        return Product.objects.filter(owner=self.request.user)

# Delete Product
class DeleteProductView(generics.DestroyAPIView):
    permission_classes = [IsShopOwner]

    def get_queryset(self):
        return Product.objects.filter(owner=self.request.user)

# Public Products
class PublicProductListView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Product.objects.filter(is_active=True)
