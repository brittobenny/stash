from unittest.mock import patch
from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import Notification
from accounts.views import NotificationListView
from inventory.models import Ingredient, PantryItem
from inventory.serializers import PantryItemSerializer
from inventory.views import recommend_meals


class RecommendMealsQuantitySelectionTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = get_user_model().objects.create_user(
            username="cook_user",
            email="cook@example.com",
            password="pass1234",
        )

        self.chicken = Ingredient.objects.create(
            name="Chicken breast",
            category="Meat",
            default_unit="grams",
            embedding=[0.1, 0.2, 0.3],
        )
        self.salt = Ingredient.objects.create(
            name="Table salt",
            category="Spice",
            default_unit="grams",
            embedding=[0.2, 0.1, 0.4],
        )

        PantryItem.objects.create(user=self.user, ingredient=self.chicken, quantity=500)
        PantryItem.objects.create(user=self.user, ingredient=self.salt, quantity=10)

    @patch("inventory.views.recommender.recommend", return_value=[])
    def test_post_name_selection_uses_actual_pantry_quantities(self, mocked_recommend):
        request = self.factory.post(
            "/api/recommend/",
            {"ingredients": ["Chicken breast", "Table salt"]},
            format="json",
        )
        force_authenticate(request, user=self.user)

        response = recommend_meals(request)
        self.assertEqual(response.status_code, 200)
        mocked_recommend.assert_called_once()

        payload = mocked_recommend.call_args.args[0]
        qty_by_name = {item["name"]: item["quantity"] for item in payload}

        self.assertEqual(qty_by_name["chicken breast"], 500.0)
        self.assertEqual(qty_by_name["table salt"], 10.0)


class PantryExpiryNotificationTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = get_user_model().objects.create_user(
            username="expiry_user",
            email="expiry@example.com",
            password="pass1234",
        )
        self.ingredient = Ingredient.objects.create(
            name="Milk",
            category="Dairy",
            default_unit="ml",
            embedding=[0.5, 0.2, 0.1],
        )

    def _fetch_notifications(self):
        request = self.factory.get("/api/accounts/notifications/")
        force_authenticate(request, user=self.user)
        return NotificationListView.as_view()(request)

    def test_notification_endpoint_creates_single_near_expiry_alert(self):
        PantryItem.objects.create(
            user=self.user,
            ingredient=self.ingredient,
            quantity=500,
            expiry_date=timezone.localdate() + timedelta(days=2),
        )

        first_response = self._fetch_notifications()
        second_response = self._fetch_notifications()

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 1)

        notification = Notification.objects.get(user=self.user)
        self.assertEqual(notification.type, "system")
        self.assertEqual(notification.data["kind"], "pantry_expiry")
        self.assertEqual(notification.data["status"], "expiring_soon")
        self.assertIn("expires in 2 days", notification.message)

    def test_outdated_expiry_alert_is_marked_read_when_date_changes(self):
        item = PantryItem.objects.create(
            user=self.user,
            ingredient=self.ingredient,
            quantity=500,
            expiry_date=timezone.localdate() + timedelta(days=1),
        )

        self._fetch_notifications()
        notification = Notification.objects.get(user=self.user)
        self.assertFalse(notification.is_read)

        item.expiry_date = timezone.localdate() + timedelta(days=10)
        item.save(update_fields=["expiry_date"])

        response = self._fetch_notifications()
        notification.refresh_from_db()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(notification.is_read)
        self.assertEqual(Notification.objects.filter(user=self.user, is_read=False).count(), 0)

    def test_pantry_serializer_exposes_expiry_status_fields(self):
        item = PantryItem.objects.create(
            user=self.user,
            ingredient=self.ingredient,
            quantity=500,
            expiry_date=timezone.localdate() + timedelta(days=3),
        )

        data = PantryItemSerializer(item).data

        self.assertEqual(data["expiry_status"], "expiring_soon")
        self.assertEqual(data["days_until_expiry"], 3)

    def test_management_command_processes_all_users(self):
        second_user = get_user_model().objects.create_user(
            username="second_expiry_user",
            email="second-expiry@example.com",
            password="pass1234",
        )
        PantryItem.objects.create(
            user=self.user,
            ingredient=self.ingredient,
            quantity=500,
            expiry_date=timezone.localdate() + timedelta(days=2),
        )
        PantryItem.objects.create(
            user=second_user,
            ingredient=self.ingredient,
            quantity=250,
            expiry_date=timezone.localdate(),
        )

        output = StringIO()
        call_command("send_expiry_alerts", stdout=output)

        self.assertEqual(Notification.objects.filter(data__kind="pantry_expiry").count(), 2)
        self.assertIn(
            "Processed 2 users and created 2 expiry notifications and 0 low-stock notifications.",
            output.getvalue(),
        )


class PantryLowStockNotificationTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = get_user_model().objects.create_user(
            username="low_stock_user",
            email="lowstock@example.com",
            password="pass1234",
        )
        self.ingredient = Ingredient.objects.create(
            name="Rice",
            category="Grain",
            default_unit="grams",
            embedding=[0.7, 0.1, 0.4],
        )

    def _fetch_notifications(self):
        request = self.factory.get("/api/accounts/notifications/")
        force_authenticate(request, user=self.user)
        return NotificationListView.as_view()(request)

    def test_notification_endpoint_creates_single_low_stock_alert(self):
        PantryItem.objects.create(
            user=self.user,
            ingredient=self.ingredient,
            quantity=100,
            low_stock_limit=250,
        )

        first_response = self._fetch_notifications()
        second_response = self._fetch_notifications()

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(Notification.objects.filter(user=self.user, data__kind="pantry_low_stock").count(), 1)

        notification = Notification.objects.get(user=self.user, data__kind="pantry_low_stock")
        self.assertEqual(notification.type, "system")
        self.assertEqual(notification.data["action"], "restock_bill")
        self.assertEqual(notification.data["route"], "/customer/cart?source=restock")
        self.assertIn("Rice is below your low-stock limit", notification.message)

    def test_recovered_stock_marks_low_stock_alert_read(self):
        item = PantryItem.objects.create(
            user=self.user,
            ingredient=self.ingredient,
            quantity=100,
            low_stock_limit=250,
        )

        self._fetch_notifications()
        notification = Notification.objects.get(user=self.user, data__kind="pantry_low_stock")
        self.assertFalse(notification.is_read)

        item.quantity = 400
        item.save(update_fields=["quantity"])

        response = self._fetch_notifications()
        notification.refresh_from_db()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(notification.is_read)
        self.assertEqual(Notification.objects.filter(user=self.user, data__kind="pantry_low_stock", is_read=False).count(), 0)

    def test_management_command_processes_low_stock_notifications(self):
        PantryItem.objects.create(
            user=self.user,
            ingredient=self.ingredient,
            quantity=100,
            low_stock_limit=250,
            expiry_date=timezone.localdate() + timedelta(days=10),
        )

        output = StringIO()
        call_command("send_expiry_alerts", stdout=output)

        self.assertEqual(Notification.objects.filter(user=self.user, data__kind="pantry_low_stock").count(), 1)
        self.assertIn(
            "Processed 1 users and created 0 expiry notifications and 1 low-stock notifications.",
            output.getvalue(),
        )
