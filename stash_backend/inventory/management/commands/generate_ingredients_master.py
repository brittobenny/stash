import csv
import re
from collections import Counter
from pathlib import Path
from urllib.parse import quote

from django.core.management.base import BaseCommand

from inventory.substitutions import normalize_name as normalize_sub_name
from nutrition.parser import parse_ingredient


class Command(BaseCommand):
    help = (
        "Generate a localized ingredients_master.csv using Indian recipe datasets "
        "as the primary source and nutrition metadata for enrichment."
    )

    CATEGORY_ORDER = ["Vegetable", "Fruit", "Meat", "Dairy", "Grain", "Spice", "Oil", "Other"]

    # Keep culturally common staples even when frequency is low.
    STAPLE_INGREDIENTS = {
        "rice",
        "matta rice",
        "idli rice",
        "raw rice",
        "onion",
        "tomato",
        "potato",
        "garlic",
        "ginger",
        "ginger garlic paste",
        "green chilli",
        "red chilli",
        "red chilli powder",
        "turmeric",
        "turmeric powder",
        "coriander",
        "coriander powder",
        "cumin",
        "cumin seeds",
        "mustard seeds",
        "fenugreek",
        "asafoetida",
        "curry leaves",
        "coconut",
        "coconut milk",
        "coconut oil",
        "sunflower oil",
        "groundnut oil",
        "ghee",
        "curd",
        "yogurt",
        "paneer",
        "toor dal",
        "chana dal",
        "urad dal",
        "moong dal",
        "jaggery",
        "tamarind",
        "lemon",
        "salt",
    }

    TOKEN_DROP = {
        "of", "and", "or", "to", "as", "for", "taste", "required", "needed", "optional",
        "fresh", "dried", "finely", "roughly", "small", "large", "medium", "whole",
        "leaf", "leaves", "stalk", "stalks", "powdered", "powder", "chopped", "sliced",
        "minced", "crushed", "ground", "split", "pinch", "pinches", "dash", "sprig",
        "sprigs", "handful", "bunch", "tsp", "tbsp", "teaspoon", "teaspoons", "tablespoon",
        "tablespoons", "cup", "cups", "gram", "grams", "g", "kg", "ml", "liter", "liters",
        "piece", "pieces", "pcs", "homemade",
    }

    TOKEN_FIXES = {
        "tomatoes": "tomato",
        "tomatoe": "tomato",
        "potatoes": "potato",
        "potatoe": "potato",
        "chillie": "chilli",
        "chillies": "chilli",
        "chilie": "chilli",
        "chilies": "chilli",
        "reen": "green",
        "inger": "ginger",
        "arlic": "garlic",
    }

    PHRASE_ALIASES = {
        "table salt": "salt",
        "sea salt": "salt",
        "kosher salt": "salt",
        "salt pepper": "salt",
        "saltpepper": "salt",
        "clove garlic": "garlic",
        "cloves garlic": "garlic",
        "garlic clove": "garlic",
        "garlic cloves": "garlic",
        "green chilie": "green chilli",
        "green chilies": "green chilli",
        "green chillies": "green chilli",
        "dry red chilli": "red chilli",
        "red chili": "red chilli",
        "red chili powder": "red chilli powder",
        "coriander dhania": "coriander",
        "coriander powder dhania": "coriander powder",
        "cumin seed jeera": "cumin seeds",
        "cumin seeds jeera": "cumin seeds",
        "cumin jeera": "cumin",
        "mustard": "mustard seeds",
        "mustard seed": "mustard seeds",
        "cumin seed": "cumin seeds",
        "white urad dal split": "urad dal",
        "white urad dal": "urad dal",
        "asafoetida hing": "asafoetida",
        "bay tej patta": "bay leaf",
        "cardamom pod seed": "cardamom",
        "cardamom elaichi podsseed": "cardamom",
        "potato aloo": "potato",
        "flour maida": "all purpose flour",
        "clove laung": "clove",
        "mint pudina": "mint",
        "bay": "bay leaf",
        "baking": "baking powder",
        "bhindi lady fingerokra": "okra",
        "cabbage patta gobi muttaikose": "cabbage",
        "cauliflower gobi": "cauliflower",
        "cauliflower gobi floret": "cauliflower",
        "kalonji onion nigella seed": "nigella seeds",
        "pearl onion sambar onion": "pearl onion",
        "spinach palak": "spinach",
        "spring onion bulb green": "spring onion",
        "spring onion green": "spring onion",
        "amchur dry mango": "amchur",
        "dry coconut kopra": "dry coconut",
        "dessicated coconut": "desiccated coconut",
        "bottle gourd lauki": "bottle gourd",
        "karela bitter gourd pavakkai": "bitter gourd",
        "inger arlic": "ginger garlic",
        "inger arlic paste": "ginger garlic paste",
        "extra virgin olive oil": "olive oil",
        "virgin olive oil": "olive oil",
        "curry": "curry leaves",
    }

    COMMON_EXCLUDE_TERMS = {
        "ketchup",
        "salsa",
        "mayo",
        "mayonnaise",
        "dressing",
        "syrup",
        "jam",
        "jelly",
        "chocolate",
        "whipping cream",
        "cheddar",
        "mozzarella",
        "parmesan",
        "feta",
        "olive",
        "quinoa",
        "celery",
        "broccoli",
        "parsley",
        "dill",
        "basil",
        "ripe banana",
    }

    def add_arguments(self, parser):
        parser.add_argument("--min-frequency", type=int, default=50)
        parser.add_argument("--max-items", type=int, default=350)
        parser.add_argument(
            "--strict-common",
            action="store_true",
            help="Apply stronger filtering for common pantry items.",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        min_frequency = max(1, int(options.get("min_frequency", 15)))
        max_items = max(0, int(options.get("max_items", 600)))
        strict_common = bool(options.get("strict_common"))
        dry_run = bool(options.get("dry_run"))

        project_root = Path(__file__).resolve().parents[3]
        data_dir = project_root / "data"
        ml_data_dir = project_root / "inventory" / "ml" / "data"

        nutrition_path = data_dir / "nutrition.csv"
        output_path = data_dir / "ingredients_master.csv"
        recipes_path = ml_data_dir / "recipes.csv"
        cleaned_recipes_path = ml_data_dir / "Cleaned_Indian_Food_Dataset.csv"

        nutrition_lookup = self._build_nutrition_lookup(nutrition_path)
        ingredient_counts = Counter()

        self._accumulate_from_cleaned_dataset(cleaned_recipes_path, ingredient_counts)
        self._accumulate_from_recipes_dataset(recipes_path, ingredient_counts)

        if not ingredient_counts:
            self.stderr.write(self.style.ERROR("No ingredients extracted from recipe datasets."))
            return

        selected = {
            name for name, count in ingredient_counts.items()
            if count >= min_frequency
        }
        selected.update(self.STAPLE_INGREDIENTS)

        ranked = sorted(
            selected,
            key=lambda name: (
                0 if name in self.STAPLE_INGREDIENTS else 1,
                -ingredient_counts.get(name, 0),
                name,
            ),
        )

        if strict_common:
            ranked = [name for name in ranked if not self._is_uncommon_for_common_mode(name)]

        if max_items and len(ranked) > max_items:
            # Keep all staples, then fill remaining slots by frequency.
            staples = [x for x in ranked if x in self.STAPLE_INGREDIENTS]
            non_staples = [x for x in ranked if x not in self.STAPLE_INGREDIENTS]
            non_staple_slots = max(0, max_items - len(staples))
            ranked = staples[:max_items] + non_staples[:non_staple_slots]

        rows = []
        for canonical_name in ranked:
            meta = nutrition_lookup.get(canonical_name, {})
            display_name = meta.get("display_name") or self._display_name(canonical_name)
            category = meta.get("category") or self._infer_category(canonical_name)
            default_unit = self._infer_unit(canonical_name, category)
            image_url = f"https://source.unsplash.com/200x200/?{quote(display_name)}"
            rows.append(
                {
                    "name": display_name,
                    "category": category,
                    "default_unit": default_unit,
                    "image_url": image_url,
                }
            )

        rows.sort(
            key=lambda r: (
                self.CATEGORY_ORDER.index(r["category"]) if r["category"] in self.CATEGORY_ORDER else 99,
                r["name"].lower(),
            )
        )

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run mode: ingredients_master.csv not written."))
        else:
            with open(output_path, "w", newline="", encoding="utf-8") as out:
                writer = csv.DictWriter(
                    out,
                    fieldnames=["name", "category", "default_unit", "image_url"],
                )
                writer.writeheader()
                writer.writerows(rows)

        self.stdout.write(
            self.style.SUCCESS(
                f"Generated {len(rows)} localized ingredients "
                f"(min_frequency={min_frequency}, max_items={max_items or 'all'}, strict_common={strict_common})."
            )
        )
        preview = ", ".join(name for name, _ in ingredient_counts.most_common(20))
        self.stdout.write(f"Top extracted ingredients: {preview}")
        if not dry_run:
            self.stdout.write(f"Output: {output_path}")

    def _build_nutrition_lookup(self, nutrition_path: Path):
        if not nutrition_path.exists():
            self.stdout.write(self.style.WARNING(f"nutrition.csv not found at {nutrition_path}; using heuristic categories only."))
            return {}

        lookup = {}
        with open(nutrition_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                raw_name = (row.get("Food Name") or "").strip()
                if not raw_name:
                    continue
                canonical = self._normalize_name(raw_name)
                if not canonical:
                    continue
                if canonical in lookup:
                    continue
                lookup[canonical] = {
                    "display_name": self._display_name(canonical),
                    "category": self._map_nutrition_category(row.get("Category Name")),
                }
        return lookup

    def _accumulate_from_cleaned_dataset(self, csv_path: Path, counter: Counter):
        if not csv_path.exists():
            self.stdout.write(self.style.WARNING(f"Dataset not found: {csv_path}"))
            return

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                raw_ingredients = str(row.get("TranslatedIngredients") or "")
                for raw in raw_ingredients.split(","):
                    parsed = parse_ingredient(raw)
                    canonical = self._normalize_name(parsed.get("name") or raw)
                    if canonical:
                        counter[canonical] += 1

    def _accumulate_from_recipes_dataset(self, csv_path: Path, counter: Counter):
        if not csv_path.exists():
            self.stdout.write(self.style.WARNING(f"Dataset not found: {csv_path}"))
            return

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                raw_ingredients = str(row.get("ingredients") or "")
                for raw in raw_ingredients.split(","):
                    canonical = self._normalize_name(raw)
                    if canonical:
                        counter[canonical] += 1

    def _normalize_name(self, name: str) -> str:
        value = normalize_sub_name(name or "")
        if not value:
            return ""

        value = re.sub(r"[^a-z ]", " ", value)
        value = re.sub(r"\s+", " ", value).strip()

        tokens = []
        for token in value.split():
            tok = self.TOKEN_FIXES.get(token, token)
            if tok in self.TOKEN_DROP or len(tok) <= 1:
                continue
            if tok.endswith("s") and len(tok) > 3:
                tok = tok[:-1]
                tok = self.TOKEN_FIXES.get(tok, tok)
            if tok in self.TOKEN_DROP or len(tok) <= 1:
                continue
            tokens.append(tok)

        normalized = " ".join(tokens).strip()
        if not normalized:
            return ""

        # Drop branded/productized phrases from the pantry master list.
        if any(marker in normalized for marker in {"del monte", "knorr", "maggi", "nestle", "saffola"}):
            return ""

        return self.PHRASE_ALIASES.get(normalized, normalized)

    def _display_name(self, canonical_name: str) -> str:
        # Keep common food abbreviations readable.
        words = canonical_name.split()
        keep_upper = {"idli", "dosa", "dal", "ghee"}
        out = []
        for word in words:
            if word in keep_upper:
                out.append(word.capitalize())
            else:
                out.append(word.capitalize())
        return " ".join(out).strip()

    def _map_nutrition_category(self, raw_category: str) -> str:
        value = (raw_category or "").strip().lower()
        if value in {"vegetables", "greens", "mushrooms"}:
            return "Vegetable"
        if value == "fruits":
            return "Fruit"
        if value == "grains":
            return "Grain"
        if value in {"meat", "seafood"}:
            return "Meat"
        if value == "dairy":
            return "Dairy"
        if value == "spices":
            return "Spice"
        if value == "oils and sauces":
            return "Oil"
        return "Other"

    def _infer_category(self, ingredient_name: str) -> str:
        name = ingredient_name.lower()

        oil_markers = {"oil", "ghee", "butter"}
        spice_markers = {
            "chilli", "turmeric", "coriander", "cumin", "mustard", "fenugreek", "pepper",
            "cardamom", "cinnamon", "clove", "masala", "asafoetida", "saffron", "bay leaf",
        }
        grain_markers = {
            "rice", "wheat", "flour", "rava", "semolina", "millet", "noodle", "vermicelli",
            "dal", "lentil", "poha",
        }
        dairy_markers = {"milk", "curd", "yogurt", "paneer", "cheese", "cream"}
        meat_markers = {"chicken", "mutton", "beef", "pork", "fish", "prawn", "egg"}
        fruit_markers = {"mango", "banana", "apple", "orange", "grape", "papaya", "lemon", "lime", "jackfruit"}
        vegetable_markers = {
            "onion", "tomato", "potato", "coconut", "carrot", "spinach", "cabbage", "cauliflower",
            "beetroot", "cucumber", "beans", "brinjal", "eggplant", "drumstick", "okra", "gourd",
            "curry leaves", "garlic", "ginger", "chilli",
        }

        if any(marker in name for marker in oil_markers):
            return "Oil"
        if any(marker in name for marker in spice_markers):
            return "Spice"
        if any(marker in name for marker in dairy_markers):
            return "Dairy"
        if any(marker in name for marker in meat_markers):
            return "Meat"
        if any(marker in name for marker in grain_markers):
            return "Grain"
        if any(marker in name for marker in fruit_markers):
            return "Fruit"
        if any(marker in name for marker in vegetable_markers):
            return "Vegetable"
        return "Other"

    def _infer_unit(self, ingredient_name: str, category: str) -> str:
        name = ingredient_name.lower()
        if "egg" in name:
            return "pcs"
        if category in {"Dairy", "Oil"}:
            return "ml"
        return "grams"

    def _is_uncommon_for_common_mode(self, ingredient_name: str) -> bool:
        if ingredient_name in self.STAPLE_INGREDIENTS:
            return False
        name = ingredient_name.lower()
        return any(term in name for term in self.COMMON_EXCLUDE_TERMS)
