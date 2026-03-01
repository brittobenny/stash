from collections import Counter

from django.test import SimpleTestCase

from inventory.management.commands.build_common_recipes import Command


class CommonRecipeBuilderTests(SimpleTestCase):
    def test_normalize_name_fixes_common_typos(self):
        cmd = Command()
        self.assertEqual(cmd._normalize_name("reen chillies"), "green chilli")
        self.assertEqual(cmd._normalize_name("inger arlic paste"), "ginger garlic paste")
        self.assertEqual(cmd._normalize_name("tomatoes"), "tomato")

    def test_commonness_score_prefers_common_and_simple_recipe(self):
        cmd = Command()
        freq = Counter(
            {
                "onion": 200,
                "tomato": 180,
                "salt": 400,
                "green chilli": 160,
                "asafoetida": 90,
                "rare ingredient": 5,
            }
        )
        strong = cmd._recipe_commonness_metrics(
            names=["onion", "tomato", "salt", "green chilli"],
            minutes=25,
            ingredient_doc_freq=freq,
            common_freq=80,
            rare_freq=20,
        )
        weak = cmd._recipe_commonness_metrics(
            names=["rare ingredient", "onion", "tomato", "salt", "green chilli", "asafoetida"],
            minutes=95,
            ingredient_doc_freq=freq,
            common_freq=80,
            rare_freq=20,
        )
        self.assertGreater(strong["common_recipe_score"], weak["common_recipe_score"])
