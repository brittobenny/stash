from django.urls import path
from .views import (
    AddProductView,
    MyProductsView,
    UpdateProductView,
    DeleteProductView,
    PublicProductListView,

    # cart + order functions (they are functions in views.py)
    get_cart,
    cart_add,
    cart_update,
    checkout,
    cancel_order,
    mark_delivered,
    confirm_add_to_pantry,
)

urlpatterns = [
    # products
    path("products/add/", AddProductView.as_view()),
    path("products/my/", MyProductsView.as_view()),
    path("products/update/<int:pk>/", UpdateProductView.as_view()),
    path("products/delete/<int:pk>/", DeleteProductView.as_view()),
    path("products/", PublicProductListView.as_view()),

    # cart
    path("cart/", get_cart),
    path("cart/add/", cart_add),
    path("cart/item/<int:item_id>/", cart_update),

    # order
    path("checkout/", checkout),
    path("orders/<int:order_id>/cancel/", cancel_order),
    path("orders/<int:order_id>/delivered/", mark_delivered),
    path("orders/<int:order_id>/confirm-pantry/", confirm_add_to_pantry),
]
