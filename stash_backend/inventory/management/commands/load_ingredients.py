import csv
from django.core.management.base import BaseCommand
from django.conf import settings
import os
from inventory.models import Ingredient


class Command(BaseCommand):
    help = "Load ingredients from CSV"

    def add_arguments(self, parser):
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Delete existing Ingredient rows before loading from CSV",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview changes without writing to DB",
        )

    def handle(self, *args, **kwargs):
        replace = kwargs.get("replace", False)
        dry_run = kwargs.get("dry_run", False)

        file_path = os.path.join(
            settings.BASE_DIR,
            "data",
            "ingredients_master.csv"
        )

        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR("CSV file not found"))
            return

        created = 0
        updated = 0

        if replace:
            existing_count = Ingredient.objects.count()
            if not dry_run:
                Ingredient.objects.all().delete()
            self.stdout.write(f"{'Would delete' if dry_run else 'Deleted'} {existing_count} existing ingredients.")

        with open(file_path, newline='', encoding="utf-8") as file:
            reader = csv.DictReader(file)

            for row in reader:
                name = (row.get("name") or "").strip()
                if not name:
                    continue

                category = (row.get("category") or "Other").strip() or "Other"
                default_unit = (row.get("default_unit") or "grams").strip() or "grams"
                image_url = (row.get("image_url") or "").strip() or None

                obj = Ingredient.objects.filter(name=name).first()
                if obj is None:
                    obj = Ingredient.objects.filter(name__iexact=name).first()
                if obj is None:
                    created += 1
                    if not dry_run:
                        Ingredient.objects.create(
                            name=name,
                            category=category,
                            default_unit=default_unit,
                            image_url=image_url,
                        )
                    continue

                changed = False
                safe_rename = not Ingredient.objects.filter(name=name).exclude(pk=obj.pk).exists()
                if obj.name != name and safe_rename:
                    obj.name = name
                    changed = True
                if obj.category != category:
                    obj.category = category
                    changed = True
                if obj.default_unit != default_unit:
                    obj.default_unit = default_unit
                    changed = True
                if obj.image_url != image_url:
                    obj.image_url = image_url
                    changed = True

                if changed:
                    updated += 1
                    if not dry_run:
                        obj.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"Ingredients sync complete. Created={created}, Updated={updated}, DryRun={dry_run}"
            )
        )
