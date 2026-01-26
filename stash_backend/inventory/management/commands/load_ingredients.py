import csv
from django.core.management.base import BaseCommand
from django.conf import settings
import os
from inventory.models import Ingredient

class Command(BaseCommand):
    help = "Load ingredients from CSV"

    def handle(self, *args, **kwargs):

        file_path = os.path.join(
            settings.BASE_DIR,
            "data",
            "ingredients_master.csv"
        )

        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR("CSV file not found"))
            return

        with open(file_path, newline='', encoding="utf-8") as file:
            reader = csv.DictReader(file)

            for row in reader:
                Ingredient.objects.get_or_create(
                    name=row["name"],
                    category=row["category"],
                    default_unit=row["default_unit"]
                )

        self.stdout.write(self.style.SUCCESS("Ingredients loaded successfully"))
