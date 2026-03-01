from django.test import SimpleTestCase

from nutrition.parser import parse_ingredient


class IngredientParserNormalizationTests(SimpleTestCase):
    def test_does_not_strip_leading_g_from_words(self):
        parsed = parse_ingredient("2 green chillies")
        self.assertEqual(parsed["name"], "green chilli")

    def test_keeps_ginger_garlic_phrase_intact(self):
        parsed = parse_ingredient("2 ginger garlic paste")
        self.assertEqual(parsed["name"], "ginger garlic paste")

    def test_normalizes_tomatoes_to_tomato(self):
        parsed = parse_ingredient("3 tomatoes")
        self.assertEqual(parsed["name"], "tomato")

    def test_removes_descriptor_tokens_like_pinch(self):
        parsed = parse_ingredient("1 pinch sugar")
        self.assertEqual(parsed["name"], "sugar")
