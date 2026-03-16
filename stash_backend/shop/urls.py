from django.urls import path
from .views import (
    AddProductView,
    MyProductsView,
    UpdateProductView,
    DeleteProductView,
    PublicProductListView,
    CategoryListCreateView,

    # cart + order functions (they are functions in views.py)
    get_cart,
    cart_add,
    cart_update,
    checkout,
    cancel_order,
    mark_delivered,
    confirm_add_to_pantry,
    list_orders,
    order_detail,
    owner_orders,
    owner_order_detail,
    owner_update_order_status,
    owner_cancel_order,
    owner_refund_order,
    owner_shop_profile,
    owner_stock_history,
    owner_stock_adjust,
    owner_bulk_stock_upload,
    owner_analytics,
    owner_analytics_export,
    admin_orders,
    admin_order_detail,
    create_feedback,
    owner_feedback,
    admin_feedback,
    admin_feedback_update,
)

urlpatterns = [
    # products
    path("categories/", CategoryListCreateView.as_view()),
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
    path("orders/", list_orders),
    path("orders/<int:order_id>/", order_detail),
    path("orders/<int:order_id>/cancel/", cancel_order),
    path("orders/<int:order_id>/delivered/", mark_delivered),
    path("orders/<int:order_id>/confirm-pantry/", confirm_add_to_pantry),

    # shop owner orders
    path("owner/orders/", owner_orders),
    path("owner/orders/<int:order_id>/", owner_order_detail),
    path("owner/orders/<int:order_id>/status/", owner_update_order_status),
    path("owner/orders/<int:order_id>/cancel/", owner_cancel_order),
    path("owner/orders/<int:order_id>/refund/", owner_refund_order),
    path("owner/profile/", owner_shop_profile),
    path("owner/stock/history/", owner_stock_history),
    path("owner/stock/adjust/", owner_stock_adjust),
    path("owner/stock/bulk-upload/", owner_bulk_stock_upload),
    path("owner/analytics/", owner_analytics),
    path("owner/analytics/export/", owner_analytics_export),

    # admin orders
    path("admin/orders/", admin_orders),
    path("admin/orders/<int:order_id>/", admin_order_detail),

    # feedback
    path("feedback/", create_feedback),
    path("feedback/owner/", owner_feedback),
    path("feedback/admin/", admin_feedback),
    path("feedback/admin/<int:feedback_id>/", admin_feedback_update),
]
