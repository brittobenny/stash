from django.core.management.base import BaseCommand

from inventory.models import Ingredient
from inventory.ml.embedding_service import generate_embeddings


class Command(BaseCommand):
    help = "Precompute and store MiniLM embeddings for Ingredient rows."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=256,
            help="Batch size for DB updates (default: 256).",
        )

    def handle(self, *args, **options):
        batch_size = max(1, int(options.get("batch_size", 256)))
        qs = Ingredient.objects.filter(embedding__isnull=True).only("id", "name")
        total = qs.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS("No ingredients need embedding backfill."))
            return

        self.stdout.write(f"Backfilling embeddings for {total} ingredients...")
        updated = 0
        buffer = []

        for ingredient in qs.iterator(chunk_size=batch_size):
            buffer.append(ingredient)
            if len(buffer) < batch_size:
                continue
            updated += self._flush_batch(buffer)
            buffer = []

        if buffer:
            updated += self._flush_batch(buffer)

        self.stdout.write(self.style.SUCCESS(f"Embedding backfill complete. Updated={updated}"))

    def _flush_batch(self, rows):
        names = [row.name for row in rows]
        embeddings = generate_embeddings(names)

        changed = []
        for row in rows:
            key = (row.name or "").strip().lower()
            embedding = embeddings.get(key)
            if not embedding:
                continue
            row.embedding = embedding
            changed.append(row)

        if changed:
            Ingredient.objects.bulk_update(changed, ["embedding"])
        return len(changed)
