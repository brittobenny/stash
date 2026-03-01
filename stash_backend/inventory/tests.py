from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from inventory.models import Ingredient, PantryItem
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
