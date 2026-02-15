import os
import csv
from django.core.management.base import BaseCommand
from inventory.models import Ingredient


class Command(BaseCommand):
    help = "Populate ingredients from nutrition.csv with category + default_unit + image_url"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Show changes without saving")

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        base_dir = os.path.dirname(os.path.abspath(__file__))
        csv_path = os.path.normpath(os.path.join(base_dir, "..", "..", "..", "data", "nutrition.csv"))

        if not os.path.exists(csv_path):
            self.stderr.write(self.style.ERROR(f"nutrition.csv not found at {csv_path}"))
            return

        created = 0
        updated = 0

        def map_category(cat):
            c = (cat or "").strip().lower()
            if c in {"vegetables", "greens", "mushrooms"}:
                return "Vegetable"
            if c == "fruits":
                return "Fruit"
            if c == "grains":
                return "Grain"
            if c in {"meat", "seafood"}:
                return "Meat"
            if c == "dairy":
                return "Dairy"
            if c == "spices":
                return "Spice"
            if c == "oils and sauces":
                return "Oil"
            return "Other"

        def infer_unit(name, mapped_category):
            n = (name or "").lower()
            if "egg" in n:
                return "pcs"
            if mapped_category in {"Dairy"}:
                return "ml"
            if mapped_category in {"Oil"}:
                return "ml"
            return "grams"

        with open(csv_path, newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                name = (row.get("Food Name") or "").strip()
                if not name:
                    continue
                category_name = row.get("Category Name")
                mapped_category = map_category(category_name)
                default_unit = infer_unit(name, mapped_category)
                image_url = f"https://source.unsplash.com/200x200/?{name.replace(' ', '%20')}"

                existing = Ingredient.objects.filter(name__iexact=name).first()
                if existing:
                    changed = False
                    if existing.category != mapped_category:
                        existing.category = mapped_category
                        changed = True
                    if existing.default_unit != default_unit:
                        existing.default_unit = default_unit
                        changed = True
                    if not existing.image_url:
                        existing.image_url = image_url
                        changed = True
                    if changed:
                        if not dry_run:
                            existing.save()
                        updated += 1
                else:
                    if not dry_run:
                        Ingredient.objects.create(
                            name=name,
                            category=mapped_category,
                            default_unit=default_unit,
                            image_url=image_url,
                        )
                    created += 1

        self.stdout.write(self.style.SUCCESS(f"Ingredients created: {created}, updated: {updated}"))
