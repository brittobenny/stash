from unittest.mock import patch

from django.test import TestCase

from inventory.models import Ingredient


class IngredientEmbeddingTests(TestCase):
    @patch("inventory.ml.embedding_service.generate_embedding", return_value=[0.12, 0.34, 0.56])
    def test_embedding_is_generated_on_save_when_empty(self, mocked_generate):
        ingredient = Ingredient.objects.create(
            name="Test Ingredient",
            category="Other",
            default_unit="grams",
        )

        ingredient.refresh_from_db()
        self.assertEqual(ingredient.embedding, [0.12, 0.34, 0.56])
        mocked_generate.assert_called_once_with("Test Ingredient")

    @patch("inventory.ml.embedding_service.generate_embedding", return_value=[0.99])
    def test_existing_embedding_is_not_regenerated(self, mocked_generate):
        ingredient = Ingredient.objects.create(
            name="Preset Ingredient",
            category="Other",
            default_unit="grams",
            embedding=[0.01, 0.02],
        )

        ingredient.refresh_from_db()
        self.assertEqual(ingredient.embedding, [0.01, 0.02])
        mocked_generate.assert_not_called()
