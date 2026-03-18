from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from unittest.mock import patch

from accounts.models import UserProfile
from inventory.models import Ingredient, PantryItem
from shop.models import Category, Product, Cart, CartItem, Order


class RestockBillTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        User = get_user_model()

        self.user = User.objects.create_user(
            username="restock_customer",
            email="restock@example.com",
            password="pass1234",
        )
        UserProfile.objects.create(
            user=self.user,
            mobile_number="9999999999",
            address="Main road",
            location="Kochi",
            role="customer",
        )

        self.shop_owner = User.objects.create_user(
            username="owner_user",
            email="owner@example.com",
            password="pass1234",
        )
        UserProfile.objects.create(
            user=self.shop_owner,
            mobile_number="8888888888",
            address="Market road",
            location="Kochi",
            role="shopowner",
        )

        self.ingredient = Ingredient.objects.create(
            name="Rice",
            category="Grain",
            default_unit="grams",
            embedding=[0.1, 0.2, 0.3],
        )
        self.category = Category.objects.create(name="Staples")
        self.product = Product.objects.create(
            owner=self.shop_owner,
            category=self.category,
            ingredient=self.ingredient,
            name="Rice Bag 1kg",
            price=80,
            stock_quantity=10,
            unit="pack",
            pack_size=1,
            pack_unit="kg",
            is_active=True,
        )
        PantryItem.objects.create(
            user=self.user,
            ingredient=self.ingredient,
            quantity=100,
            low_stock_limit=250,
        )

        self.client.force_authenticate(user=self.user)

    def test_restock_bill_returns_matched_shop_item(self):
        response = self.client.get("/api/shop/restock-bill/")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["summary"]["item_count"], 1)
        self.assertEqual(data["summary"]["matched_count"], 1)
        line = data["items"][0]
        self.assertEqual(line["ingredient_name"], "Rice")
        self.assertTrue(line["matched"])
        self.assertEqual(line["product_id"], self.product.id)
        self.assertEqual(line["suggested_quantity"], 1)

    def test_apply_restock_bill_loads_cart(self):
        response = self.client.post("/api/shop/restock-bill/apply/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["applied_count"], 1)
        self.assertEqual(len(data["cart"]["items"]), 1)
        self.assertEqual(data["cart"]["items"][0]["product"]["id"], self.product.id)
        self.assertEqual(data["cart"]["items"][0]["quantity"], 1)


class CheckoutEmailTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        User = get_user_model()

        self.user = User.objects.create_user(
            username="email_customer",
            email="customer@example.com",
            password="pass1234",
            first_name="Anu",
        )
        UserProfile.objects.create(
            user=self.user,
            mobile_number="9999999999",
            address="Main road",
            location="Kochi",
            role="customer",
        )

        self.shop_owner = User.objects.create_user(
            username="email_owner",
            email="owner@example.com",
            password="pass1234",
        )
        UserProfile.objects.create(
            user=self.shop_owner,
            mobile_number="8888888888",
            address="Market road",
            location="Kochi",
            role="shopowner",
        )

        self.ingredient = Ingredient.objects.create(
            name="Tomato",
            category="Vegetable",
            default_unit="grams",
            embedding=[0.1, 0.3, 0.5],
        )
        self.category = Category.objects.create(name="Fresh")
        self.product = Product.objects.create(
            owner=self.shop_owner,
            category=self.category,
            ingredient=self.ingredient,
            name="Tomato Pack",
            price=20,
            stock_quantity=10,
            unit="pcs",
            pack_size=1,
            pack_unit="pcs",
            is_active=True,
        )

        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=2)
        self.client.force_authenticate(user=self.user)

    @patch("shop.views.send_mail")
    def test_checkout_sends_order_confirmation_email(self, mocked_send_mail):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post("/api/shop/checkout/", {}, format="json")

        self.assertEqual(response.status_code, 201)
        order = Order.objects.get(user=self.user)
        mocked_send_mail.assert_called_once()

        _, kwargs = mocked_send_mail.call_args
        self.assertEqual(kwargs["recipient_list"], ["customer@example.com"])
        self.assertEqual(kwargs["subject"], f"Stash order #{order.id} confirmed")
        self.assertIn(f"Your order #{order.id} has been placed successfully.", kwargs["message"])
        self.assertIn("Tomato Pack x 2", kwargs["message"])
