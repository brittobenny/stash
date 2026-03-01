import os
import re
from collections import Counter
from pathlib import Path

import pandas as pd
from django.core.management.base import BaseCommand

from nutrition.parser import parse_ingredient
from inventory.substitutions import normalize_name as normalize_sub_name


class Command(BaseCommand):
    help = (
        "Build a filtered common_recipes.csv from Cleaned_Indian_Food_Dataset.csv "
        "using ingredient frequency and recipe simplicity."
    )

    TOKEN_DROP = {
        "of", "and", "or", "to", "as", "for", "taste", "required", "needed", "optional",
        "fresh", "dried", "finely", "roughly", "small", "large", "medium", "whole",
        "leaf", "leaves", "stalk", "stalks", "powdered", "powder", "chopped", "sliced",
        "minced", "crushed", "ground", "split", "pinch", "pinches", "dash", "sprig",
        "sprigs", "handful", "bunch", "tsp", "tbsp", "teaspoon", "teaspoons", "tablespoon",
        "tablespoons", "cup", "cups", "gram", "grams", "g", "kg", "ml", "liter", "liters",
        "piece", "pieces", "pcs",
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
        "green chilie": "green chilli",
        "green chilies": "green chilli",
        "green chillies": "green chilli",
        "red chili": "red chilli",
        "red chili powder": "red chilli powder",
        "cumin seed": "cumin seeds",
        "mustard seed": "mustard seeds",
        "curry": "curry leaves",
        "inger arlic": "ginger garlic",
        "inger arlic paste": "ginger garlic paste",
        "white urad dal split": "urad dal",
        "white urad dal": "urad dal",
    }

    def add_arguments(self, parser):
        parser.add_argument("--input", type=str, default="")
        parser.add_argument("--output", type=str, default="")
        parser.add_argument("--common-freq", type=int, default=80)
        parser.add_argument("--rare-freq", type=int, default=20)
        parser.add_argument("--keep-percent", type=float, default=40.0)
        parser.add_argument("--max-minutes", type=float, default=75.0)
        parser.add_argument("--min-ingredients", type=int, default=4)
        parser.add_argument("--max-ingredients", type=int, default=14)
        parser.add_argument(
            "--all-cuisines",
            action="store_true",
            help="Disable Indian-only filter (Indian-only is default).",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        input_path, output_path = self._resolve_paths(options)
        common_freq = max(1, int(options.get("common_freq", 80)))
        rare_freq = max(1, int(options.get("rare_freq", 20)))
        keep_percent = float(options.get("keep_percent", 40.0))
        keep_percent = max(1.0, min(100.0, keep_percent))
        max_minutes = max(0.0, float(options.get("max_minutes", 75.0)))
        min_ingredients = max(1, int(options.get("min_ingredients", 4)))
        max_ingredients = max(min_ingredients, int(options.get("max_ingredients", 14)))
        all_cuisines = bool(options.get("all_cuisines"))
        dry_run = bool(options.get("dry_run"))

        if not input_path.exists():
            self.stderr.write(self.style.ERROR(f"Input dataset not found: {input_path}"))
            return

        df = pd.read_csv(input_path)
        required = {"TranslatedIngredients", "TotalTimeInMins"}
        missing = required - set(df.columns)
        if missing:
            self.stderr.write(self.style.ERROR(f"Input dataset missing required columns: {sorted(missing)}"))
            return
        if df.empty:
            self.stderr.write(self.style.ERROR("Input dataset is empty."))
            return

        original_count = len(df)
        if not all_cuisines and "Cuisine" in df.columns:
            cuisine = df["Cuisine"].fillna("").astype(str).str.strip().str.lower()
            keep_mask = cuisine.str.contains("indian", na=False) | (cuisine == "")
            df = df[keep_mask].copy()
            self.stdout.write(f"Cuisine filter applied (Indian-only): {len(df)} / {original_count} rows kept.")

        if df.empty:
            self.stderr.write(self.style.ERROR("No rows left after cuisine filtering."))
            return

        ingredient_lists = []
        ingredient_doc_freq = Counter()

        for raw_ingredients in df["TranslatedIngredients"].fillna(""):
            names = self._extract_canonical_ingredients(raw_ingredients)
            ingredient_lists.append(names)
            ingredient_doc_freq.update(set(names))

        quality_rows = []
        for idx, names in enumerate(ingredient_lists):
            minutes = self._safe_float(df.iloc[idx].get("TotalTimeInMins"), default=0.0)
            metrics = self._recipe_commonness_metrics(
                names=names,
                minutes=minutes,
                ingredient_doc_freq=ingredient_doc_freq,
                common_freq=common_freq,
                rare_freq=rare_freq,
            )
            quality_rows.append(metrics)

        quality_df = pd.DataFrame(quality_rows)
        result = df.copy()
        result["common_recipe_score"] = quality_df["common_recipe_score"]
        result["common_ratio"] = quality_df["common_ratio"]
        result["rare_ratio"] = quality_df["rare_ratio"]
        result["ingredient_count"] = quality_df["ingredient_count"]
        result["time_score"] = quality_df["time_score"]
        result["simplicity_score"] = quality_df["simplicity_score"]
        result["_minutes_num"] = result["TotalTimeInMins"].apply(lambda x: self._safe_float(x, default=0.0))

        hard_mask = (
            (result["ingredient_count"] >= min_ingredients)
            & (result["ingredient_count"] <= max_ingredients)
            & ((result["_minutes_num"] <= max_minutes) | (result["_minutes_num"] <= 0))
        )
        before_hard = len(result)
        result = result[hard_mask].copy()
        self.stdout.write(
            f"Hard filters applied (minutes<={max_minutes}, ingredients={min_ingredients}-{max_ingredients}): "
            f"{len(result)} / {before_hard} rows kept."
        )

        if result.empty:
            self.stderr.write(self.style.ERROR("No rows left after hard filters. Relax filter parameters."))
            return

        keep_count = max(1, int(round(len(result) * (keep_percent / 100.0))))
        result = result.sort_values(by="common_recipe_score", ascending=False).head(keep_count).copy()
        result.drop(columns=["_minutes_num"], inplace=True, errors="ignore")

        if not dry_run:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            result.to_csv(output_path, index=False)

        self.stdout.write(
            self.style.SUCCESS(
                f"Built common recipes: kept {len(result)} / {len(df)} rows "
                f"(keep_percent={keep_percent}, common_freq={common_freq}, rare_freq={rare_freq}, "
                f"max_minutes={max_minutes}, ingredient_range={min_ingredients}-{max_ingredients}, "
                f"all_cuisines={all_cuisines})."
            )
        )
        top_names = result["TranslatedRecipeName"].head(10).tolist() if "TranslatedRecipeName" in result.columns else []
        if top_names:
            self.stdout.write("Top examples:")
            for name in top_names:
                self.stdout.write(f"- {name}")
        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run mode: output file not written."))
        else:
            self.stdout.write(f"Output: {output_path}")

    def _resolve_paths(self, options):
        default_input = (
            Path(__file__).resolve().parents[3]
            / "inventory"
            / "ml"
            / "data"
            / "Cleaned_Indian_Food_Dataset.csv"
        )
        default_output = (
            Path(__file__).resolve().parents[3]
            / "inventory"
            / "ml"
            / "data"
            / "common_recipes.csv"
        )

        input_arg = (options.get("input") or "").strip()
        output_arg = (options.get("output") or "").strip()
        input_path = Path(input_arg) if input_arg else default_input
        output_path = Path(output_arg) if output_arg else default_output
        return input_path, output_path

    def _extract_canonical_ingredients(self, raw_ingredients: str):
        names = []
        seen = set()

        for raw in str(raw_ingredients or "").split(","):
            parsed = parse_ingredient(raw)
            canonical = self._normalize_name(parsed.get("name") or raw)
            if not canonical or canonical in seen:
                continue
            seen.add(canonical)
            names.append(canonical)
        return names

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
        return self.PHRASE_ALIASES.get(normalized, normalized)

    def _recipe_commonness_metrics(self, names, minutes, ingredient_doc_freq, common_freq, rare_freq):
        ingredient_count = len(names)
        if ingredient_count <= 0:
            return {
                "common_recipe_score": 0.0,
                "common_ratio": 0.0,
                "rare_ratio": 1.0,
                "ingredient_count": 0,
                "time_score": 0.0,
                "simplicity_score": 0.0,
            }

        common_count = sum(1 for n in names if ingredient_doc_freq.get(n, 0) >= common_freq)
        rare_count = sum(1 for n in names if ingredient_doc_freq.get(n, 0) < rare_freq)
        common_ratio = common_count / ingredient_count
        rare_ratio = rare_count / ingredient_count

        if 5 <= ingredient_count <= 12:
            simplicity_score = 1.0
        elif ingredient_count < 5:
            simplicity_score = max(0.35, ingredient_count / 5.0)
        else:
            simplicity_score = max(0.2, 12.0 / ingredient_count)

        if minutes <= 0:
            time_score = 0.5
        elif minutes <= 30:
            time_score = 1.0
        elif minutes <= 45:
            time_score = 0.85
        elif minutes <= 60:
            time_score = 0.7
        elif minutes <= 90:
            time_score = 0.5
        else:
            time_score = 0.3

        score = (
            (common_ratio * 0.6)
            + ((1.0 - rare_ratio) * 0.2)
            + (time_score * 0.1)
            + (simplicity_score * 0.1)
        )

        return {
            "common_recipe_score": round(score, 6),
            "common_ratio": round(common_ratio, 6),
            "rare_ratio": round(rare_ratio, 6),
            "ingredient_count": ingredient_count,
            "time_score": round(time_score, 6),
            "simplicity_score": round(simplicity_score, 6),
        }

    def _safe_float(self, value, default=0.0):
        try:
            return float(value)
        except (TypeError, ValueError):
            return float(default)
