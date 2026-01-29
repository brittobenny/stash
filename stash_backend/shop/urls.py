from django.urls import path
from .views import (
    AddProductView,
    MyProductsView,
    UpdateProductView,
    DeleteProductView,
    PublicProductListView
)

urlpatterns = [
    path("products/add/", AddProductView.as_view()),
    path("products/my/", MyProductsView.as_view()),
    path("products/update/<int:pk>/", UpdateProductView.as_view()),
    path("products/delete/<int:pk>/", DeleteProductView.as_view()),
    path("products/", PublicProductListView.as_view()),
]
