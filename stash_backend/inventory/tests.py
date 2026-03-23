from unittest.mock import patch
from datetime import timedelta
from io import StringIO

import pandas as pd
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import Notification
from accounts.views import NotificationListView
from inventory.ml.recommender import MealRecommender
from inventory.models import Ingredient, PantryItem, PantryItemBatch
from inventory.pantry_batches import add_pantry_stock, consume_pantry_quantity, update_pantry_batch_record
from inventory.serializers import PantryItemSerializer
from inventory.views import recommend_meals, cook_recipe
from nutrition.models import CookedRecipeLog, DailyNutritionScore, WeeklyNutritionScore


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

    @patch("inventory.views.recommender.recommend", return_value=[])
    def test_post_selected_hero_is_forwarded_to_recommender(self, mocked_recommend):
        request = self.factory.post(
            "/api/recommend/",
            {"ingredients": ["Chicken breast"], "hero_ingredient": "Chicken breast"},
            format="json",
        )
        force_authenticate(request, user=self.user)

        response = recommend_meals(request)

        self.assertEqual(response.status_code, 200)
        mocked_recommend.assert_called_once()
        self.assertEqual(mocked_recommend.call_args.kwargs["selected_hero_ingredient"], "Chicken breast")


class HeroIngredientRecommendationRankingTests(TestCase):
    def _build_recommender(self):
        recommender = MealRecommender()
        recommender.loaded = True
        recommender._embedding_lookup_cache = {}
        recommender.recipes = pd.DataFrame(
            [
                {
                    "id": 1,
                    "name": "Egg Omelette",
                    "minutes": 10,
                    "image_url": "",
                    "instructions": "Beat eggs. Cook gently.",
                    "cuisine": "General",
                    "parsed_ingredients": [],
                    "ingredient_names": ["egg", "onion", "tomato", "salt"],
                    "ingredient_quantities": [2, 50, 40, 2],
                    "ingredients_set": {"egg", "onion", "tomato", "salt"},
                    "hero_ingredients": ["egg"],
                    "hero_ingredient": "egg",
                },
                {
                    "id": 2,
                    "name": "Egg Salad",
                    "minutes": 15,
                    "image_url": "",
                    "instructions": "Boil eggs. Toss salad.",
                    "cuisine": "General",
                    "parsed_ingredients": [],
                    "ingredient_names": ["egg", "tomato", "onion", "cucumber"],
                    "ingredient_quantities": [2, 60, 40, 50],
                    "ingredients_set": {"egg", "tomato", "onion", "cucumber"},
                    "hero_ingredients": ["egg"],
                    "hero_ingredient": "egg",
                },
                {
                    "id": 3,
                    "name": "Egg Hakka Noodles",
                    "minutes": 20,
                    "image_url": "",
                    "instructions": "Boil noodles. Stir fry egg and vegetables.",
                    "cuisine": "General",
                    "parsed_ingredients": [],
                    "ingredient_names": ["egg", "noodle", "onion", "tomato"],
                    "ingredient_quantities": [2, 100, 30, 30],
                    "ingredients_set": {"egg", "noodle", "onion", "tomato"},
                    "hero_ingredients": ["egg", "noodle"],
                    "hero_ingredient": "egg",
                },
            ]
        )
        return recommender

    def test_selected_egg_hero_prefers_easiest_recipe_without_noodles(self):
        recommender = self._build_recommender()

        results = recommender.recommend(
            [
                {"name": "egg", "quantity": 4},
                {"name": "onion", "quantity": 100},
                {"name": "tomato", "quantity": 100},
            ],
            top_k=3,
            min_match_percent=0,
            selected_hero_ingredient="egg",
        )

        self.assertEqual([item["name"] for item in results[:3]], ["Egg Omelette", "Egg Salad", "Egg Hakka Noodles"])
        self.assertEqual(results[0]["selected_hero_ingredient"], "egg")
        self.assertIn("noodle", results[2]["supporting_hero_missing"])

    def test_selected_egg_hero_promotes_noodles_when_secondary_hero_is_available(self):
        recommender = self._build_recommender()

        results = recommender.recommend(
            [
                {"name": "egg", "quantity": 4},
                {"name": "onion", "quantity": 100},
                {"name": "tomato", "quantity": 100},
                {"name": "noodle", "quantity": 150},
            ],
            top_k=3,
            min_match_percent=0,
            selected_hero_ingredient="egg",
        )

        self.assertEqual(results[0]["name"], "Egg Hakka Noodles")
        self.assertIn("noodle", results[0]["supporting_hero_matches"])

    def test_selected_egg_hero_excludes_recipes_where_egg_is_only_incidental(self):
        recommender = self._build_recommender()
        recommender.recipes = pd.concat(
            [
                recommender.recipes,
                pd.DataFrame(
                    [
                        {
                            "id": 4,
                            "name": "Kachi Tikya Recipe  - Chicken In Tomato Gravy With Potatoes",
                            "minutes": 46,
                            "image_url": "",
                            "instructions": "Marinate chicken and cook in tomato gravy.",
                            "cuisine": "General",
                            "parsed_ingredients": [],
                            "ingredient_names": ["tomato", "chicken", "egg", "onion", "potato"],
                            "ingredient_quantities": [400, 1000, 50, 200, 600],
                            "ingredients_set": {"tomato", "chicken", "egg", "onion", "potato"},
                            "hero_ingredients": ["chicken", "tomato"],
                            "hero_ingredient": "chicken",
                        }
                    ]
                ),
            ],
            ignore_index=True,
        )

        results = recommender.recommend(
            [
                {"name": "egg", "quantity": 4},
                {"name": "onion", "quantity": 100},
                {"name": "tomato", "quantity": 100},
            ],
            top_k=10,
            min_match_percent=0,
            selected_hero_ingredient="egg",
        )

        names = [item["name"] for item in results]
        self.assertNotIn("Kachi Tikya Recipe  - Chicken In Tomato Gravy With Potatoes", names)

    def test_selected_hero_only_uses_recipes_with_hero_in_title(self):
        recommender = self._build_recommender()
        recommender.recipes = pd.concat(
            [
                recommender.recipes,
                pd.DataFrame(
                    [
                        {
                            "id": 5,
                            "name": "Creamy Breakfast Curry",
                            "minutes": 18,
                            "image_url": "",
                            "instructions": "Cook eggs with onion and tomato.",
                            "cuisine": "General",
                            "parsed_ingredients": [],
                            "ingredient_names": ["egg", "onion", "tomato"],
                            "ingredient_quantities": [2, 50, 50],
                            "ingredients_set": {"egg", "onion", "tomato"},
                            "hero_ingredients": ["egg"],
                            "hero_ingredient": "egg",
                        }
                    ]
                ),
            ],
            ignore_index=True,
        )

        results = recommender.recommend(
            [
                {"name": "egg", "quantity": 4},
                {"name": "onion", "quantity": 100},
                {"name": "tomato", "quantity": 100},
            ],
            top_k=10,
            min_match_percent=0,
            selected_hero_ingredient="egg",
        )

        names = [item["name"] for item in results]
        self.assertNotIn("Creamy Breakfast Curry", names)

    def test_household_spices_do_not_drag_down_match_score(self):
        recommender = self._build_recommender()

        results = recommender.recommend(
            [
                {"name": "egg", "quantity": 4},
                {"name": "onion", "quantity": 100},
                {"name": "tomato", "quantity": 100},
            ],
            top_k=3,
            min_match_percent=0,
            selected_hero_ingredient="egg",
        )

        omelette = next(item for item in results if item["name"] == "Egg Omelette")
        self.assertGreaterEqual(omelette["match_percent"], 50.0)

    def test_recommendation_fills_up_to_top_k_from_title_filtered_pool(self):
        recommender = self._build_recommender()
        extra_rows = []
        for index in range(4, 15):
            extra_rows.append(
                {
                    "id": index,
                    "name": f"Egg Recipe {index}",
                    "minutes": 10 + index,
                    "image_url": "",
                    "instructions": "Cook egg with pantry basics.",
                    "cuisine": "General",
                    "parsed_ingredients": [],
                    "ingredient_names": ["egg", "onion"],
                    "ingredient_quantities": [2, 30],
                    "ingredients_set": {"egg", "onion"},
                    "hero_ingredients": ["egg"],
                    "hero_ingredient": "egg",
                }
            )
        recommender.recipes = pd.concat([recommender.recipes, pd.DataFrame(extra_rows)], ignore_index=True)

        results = recommender.recommend(
            [
                {"name": "egg", "quantity": 4},
                {"name": "onion", "quantity": 100},
            ],
            top_k=10,
            min_match_percent=25,
            selected_hero_ingredient="egg",
        )

        self.assertEqual(len(results), 10)

    def test_missing_secondary_hero_pushes_recipe_below_pure_egg_recipes(self):
        recommender = self._build_recommender()
        recommender.recipes = pd.concat(
            [
                recommender.recipes,
                pd.DataFrame(
                    [
                        {
                            "id": 15,
                            "name": "Spinach Egg Muffins Recipe",
                            "minutes": 30,
                            "image_url": "",
                            "instructions": "Bake egg muffins with spinach.",
                            "cuisine": "General",
                            "parsed_ingredients": [],
                            "ingredient_names": ["egg", "spinach", "onion", "tomato"],
                            "ingredient_quantities": [2, 60, 40, 30],
                            "ingredients_set": {"egg", "spinach", "onion", "tomato"},
                            "hero_ingredients": ["egg", "spinach"],
                            "hero_ingredient": "egg",
                        },
                        {
                            "id": 16,
                            "name": "Broccoli Egg Bhurji Recipe",
                            "minutes": 30,
                            "image_url": "",
                            "instructions": "Cook broccoli bhurji with egg.",
                            "cuisine": "General",
                            "parsed_ingredients": [],
                            "ingredient_names": ["egg", "broccoli", "onion", "tomato"],
                            "ingredient_quantities": [2, 60, 40, 30],
                            "ingredients_set": {"egg", "broccoli", "onion", "tomato"},
                            "hero_ingredients": ["broccoli", "egg", "onion"],
                            "hero_ingredient": "broccoli",
                        },
                        {
                            "id": 17,
                            "name": "Egg Salad Recipe",
                            "minutes": 12,
                            "image_url": "",
                            "instructions": "Mix egg salad.",
                            "cuisine": "General",
                            "parsed_ingredients": [],
                            "ingredient_names": ["egg", "tomato", "onion", "mayonnaise"],
                            "ingredient_quantities": [2, 40, 20, 10],
                            "ingredients_set": {"egg", "tomato", "onion", "mayonnaise"},
                            "hero_ingredients": ["egg"],
                            "hero_ingredient": "egg",
                        },
                    ]
                ),
            ],
            ignore_index=True,
        )

        results = recommender.recommend(
            [
                {"name": "salt", "quantity": 10},
                {"name": "egg", "quantity": 4},
                {"name": "tomato", "quantity": 100},
            ],
            top_k=10,
            min_match_percent=0,
            selected_hero_ingredient="egg",
        )

        names = [item["name"] for item in results]
        self.assertLess(names.index("Egg Salad Recipe"), names.index("Spinach Egg Muffins Recipe"))
        self.assertLess(names.index("Egg Salad Recipe"), names.index("Broccoli Egg Bhurji Recipe"))


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
        add_pantry_stock(
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
        _, batch = add_pantry_stock(
            user=self.user,
            ingredient=self.ingredient,
            quantity=500,
            expiry_date=timezone.localdate() + timedelta(days=1),
        )

        self._fetch_notifications()
        notification = Notification.objects.get(user=self.user)
        self.assertFalse(notification.is_read)

        update_pantry_batch_record(
            batch,
            quantity=batch.quantity,
            expiry_date=timezone.localdate() + timedelta(days=10),
        )

        response = self._fetch_notifications()
        notification.refresh_from_db()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(notification.is_read)
        self.assertEqual(Notification.objects.filter(user=self.user, is_read=False).count(), 0)

    def test_pantry_serializer_exposes_expiry_status_fields(self):
        item, _ = add_pantry_stock(
            user=self.user,
            ingredient=self.ingredient,
            quantity=500,
            expiry_date=timezone.localdate() + timedelta(days=3),
        )

        data = PantryItemSerializer(item).data

        self.assertEqual(data["expiry_status"], "expiring_soon")
        self.assertEqual(data["days_until_expiry"], 3)
        self.assertEqual(data["batch_count"], 1)
        self.assertEqual(len(data["batches"]), 1)

    def test_management_command_processes_all_users(self):
        second_user = get_user_model().objects.create_user(
            username="second_expiry_user",
            email="second-expiry@example.com",
            password="pass1234",
        )
        add_pantry_stock(
            user=self.user,
            ingredient=self.ingredient,
            quantity=500,
            expiry_date=timezone.localdate() + timedelta(days=2),
        )
        add_pantry_stock(
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

    def test_multiple_batches_keep_nearest_expiry_visible(self):
        item, _ = add_pantry_stock(
            user=self.user,
            ingredient=self.ingredient,
            quantity=300,
            expiry_date=timezone.localdate() + timedelta(days=2),
        )
        item, _ = add_pantry_stock(
            user=self.user,
            ingredient=self.ingredient,
            quantity=200,
            expiry_date=timezone.localdate() + timedelta(days=8),
        )

        item.refresh_from_db()
        data = PantryItemSerializer(item).data

        self.assertEqual(data["quantity"], 500.0)
        self.assertEqual(data["expiry_date"], (timezone.localdate() + timedelta(days=2)).isoformat())
        self.assertEqual(data["batch_count"], 2)
        self.assertEqual(len(data["batches"]), 2)


class NutritionCookFlowTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = get_user_model().objects.create_user(
            username="nutrition_user",
            email="nutrition@example.com",
            password="pass1234",
        )
        self.egg = Ingredient.objects.create(
            name="Egg",
            category="Meat",
            default_unit="grams",
            embedding=[0.1, 0.2, 0.3],
        )
        self.tomato = Ingredient.objects.create(
            name="Tomato",
            category="Vegetable",
            default_unit="grams",
            embedding=[0.3, 0.2, 0.1],
        )
        add_pantry_stock(user=self.user, ingredient=self.egg, quantity=200)
        add_pantry_stock(user=self.user, ingredient=self.tomato, quantity=150)

    @patch("inventory.views.recommender.get_by_id")
    def test_cook_recipe_creates_nutrition_records(self, mocked_get_by_id):
        mocked_get_by_id.return_value = {
            "id": 99,
            "name": "Simple Egg Tomato Fry",
            "parsed_ingredients": [
                {"name": "egg", "grams": 120},
                {"name": "tomato", "grams": 80},
            ],
        }

        request = self.factory.post(
            "/api/cook/",
            {"recipe_id": 99},
            format="json",
        )
        force_authenticate(request, user=self.user)

        response = cook_recipe(request)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(CookedRecipeLog.objects.filter(user=self.user, recipe_id=99).exists())
        self.assertTrue(DailyNutritionScore.objects.filter(user=self.user).exists())
        self.assertTrue(WeeklyNutritionScore.objects.filter(user=self.user).exists())


class PantryBatchConsumptionTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="batch_consume_user",
            email="batch-consume@example.com",
            password="pass1234",
        )
        self.ingredient = Ingredient.objects.create(
            name="Curd",
            category="Dairy",
            default_unit="grams",
            embedding=[0.3, 0.2, 0.4],
        )

    def test_consumption_uses_earliest_expiring_batch_first(self):
        item, _ = add_pantry_stock(
            user=self.user,
            ingredient=self.ingredient,
            quantity=200,
            expiry_date=timezone.localdate() + timedelta(days=1),
        )
        item, _ = add_pantry_stock(
            user=self.user,
            ingredient=self.ingredient,
            quantity=300,
            expiry_date=timezone.localdate() + timedelta(days=5),
        )

        result = consume_pantry_quantity(item, 250)
        remaining_batches = list(PantryItemBatch.objects.filter(pantry_item__user=self.user).order_by("expiry_date"))

        self.assertEqual(result["consumed"], 250.0)
        self.assertEqual(len(remaining_batches), 1)
        self.assertEqual(remaining_batches[0].quantity, 250.0)
        self.assertEqual(remaining_batches[0].expiry_date, timezone.localdate() + timedelta(days=5))


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
