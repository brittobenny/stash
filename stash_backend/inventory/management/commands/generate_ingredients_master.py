import os
import csv
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Generate ingredients_master.csv from nutrition.csv"

    def handle(self, *args, **options):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        nutrition_path = os.path.normpath(os.path.join(base_dir, "..", "..", "..", "data", "nutrition.csv"))
        out_path = os.path.normpath(os.path.join(base_dir, "..", "..", "..", "data", "ingredients_master.csv"))

        if not os.path.exists(nutrition_path):
            self.stderr.write(self.style.ERROR(f"nutrition.csv not found at {nutrition_path}"))
            return

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

        seen = set()
        rows = []
        with open(nutrition_path, newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                name = (row.get("Food Name") or "").strip()
                if not name:
                    continue
                key = name.lower()
                if key in seen:
                    continue
                seen.add(key)
                mapped_category = map_category(row.get("Category Name"))
                default_unit = infer_unit(name, mapped_category)
                image_url = f"https://source.unsplash.com/200x200/?{name.replace(' ', '%20')}"
                rows.append({
                    "name": name,
                    "category": mapped_category,
                    "default_unit": default_unit,
                    "image_url": image_url,
                })

        with open(out_path, "w", newline="", encoding="utf-8") as out:
            writer = csv.DictWriter(out, fieldnames=["name", "category", "default_unit", "image_url"])
            writer.writeheader()
            for r in rows:
                writer.writerow(r)

        self.stdout.write(self.style.SUCCESS(f"Generated {len(rows)} rows at {out_path}"))
