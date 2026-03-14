from types import SimpleNamespace

from django.test import SimpleTestCase

from inventory.views import build_ingredient_status


def _pantry_item(name: str, quantity: float):
    return SimpleNamespace(
        ingredient=SimpleNamespace(name=name),
        quantity=quantity,
    )


class RecipeDetailSpiceVisibilityTests(SimpleTestCase):
    def test_basic_spices_are_not_marked_missing_in_ingredient_status(self):
        pantry_items = [
            _pantry_item("onion", 100),
        ]
        parsed_ingredients = [
            {"name": "onion", "grams": 100, "display": "1 piece"},
            {"name": "cumin", "grams": 10, "display": "1 tablespoon"},
            {"name": "dry red chilli", "grams": 15, "display": "15 piece"},
            {"name": "chicken", "grams": 1000, "display": "1 kg"},
        ]

        status_list = build_ingredient_status(pantry_items, parsed_ingredients)
        status_by_name = {item["name"]: item["status"] for item in status_list}
        assumed_by_name = {item["name"]: item.get("assumed_available") for item in status_list}

        self.assertEqual(status_by_name.get("cumin"), "have")
        self.assertEqual(status_by_name.get("dry red chilli"), "have")
        self.assertEqual(status_by_name.get("chicken"), "missing")
        self.assertTrue(assumed_by_name.get("cumin"))
        self.assertTrue(assumed_by_name.get("dry red chilli"))
