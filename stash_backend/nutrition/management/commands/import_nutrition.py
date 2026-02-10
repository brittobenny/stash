import csv
from django.core.management.base import BaseCommand
from nutrition.models import NutritionItem
from django.conf import settings
import os

class Command(BaseCommand):
    help = "Import nutrition CSV into database"

    def handle(self, *args, **kwargs):

        file_path = os.path.join(
            settings.BASE_DIR,
            "data",
            "nutrition.csv"
        )

        with open(file_path, newline='', encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)

            count = 0

            for row in reader:
                name = row["Food Name"].strip().lower()

                NutritionItem.objects.update_or_create(
                    name=name,
                    defaults={
                        "calories": float(row["Calories"] or 0),
                        "carbs": float(row["Carbs"] or 0),
                        "protein": float(row["Protein"] or 0),
                        "fats": float(row["Fats"] or 0),
                        "fiber": float(row.get("Fiber", 0) or 0)
                    }
                )

                count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Imported {count} nutrition records"
        ))
