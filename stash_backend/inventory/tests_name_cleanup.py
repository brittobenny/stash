from django.test import SimpleTestCase

from inventory.ml.recommender import MealRecommender
from inventory.views import normalize_name


class RecommenderNameCleanupTests(SimpleTestCase):
    def test_canonical_fixes_common_typos(self):
        recommender = MealRecommender()
        self.assertEqual(recommender._canonical_name("reen chillie"), "green chilli")
        self.assertEqual(recommender._canonical_name("inger arlic paste"), "ginger garlic paste")
        self.assertEqual(recommender._canonical_name("tomatoe"), "tomato")

    def test_parse_recipe_ingredients_emits_clean_names(self):
        recommender = MealRecommender()
        parsed, names, _, _, _ = recommender._parse_recipe_ingredients(
            "2 Green chillies,2 Ginger Garlic Paste,3 Tomatoes"
        )
        parsed_names = [item["name"] for item in parsed]
        self.assertIn("green chilli", parsed_names)
        self.assertIn("ginger garlic paste", parsed_names)
        self.assertIn("tomato", parsed_names)
        self.assertIn("tomato", names)

    def test_inventory_view_normalizer_fixes_recipe_detail_typos(self):
        self.assertEqual(normalize_name("reen chillie"), "green chilli")
        self.assertEqual(normalize_name("inger arlic paste"), "ginger garlic paste")
        self.assertEqual(normalize_name("tomatoes"), "tomato")
        self.assertEqual(normalize_name("table salt"), "salt")
        self.assertEqual(normalize_name("pinch sugar"), "sugar")
        self.assertEqual(normalize_name("sprig curry leaves"), "curry")
