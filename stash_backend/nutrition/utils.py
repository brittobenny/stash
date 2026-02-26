import os
import re

import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATASET_PATH = os.path.join(
    BASE_DIR,
    "..",
    "data",
    "nutrition.csv",
)

ALIASES = {
    "khichdi pongal": "khichdi",
    "pongal": "khichdi",
    "rice flour": "rice flour",
    "extra virgin olive oil": "olive oil",
    "clove garlic": "garlic",
    "garlic clove": "garlic",
    "spring onion green": "spring onion",
    "green onion": "spring onion",
}

STOPWORDS = {
    "cup", "cups", "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons",
    "gram", "grams", "g", "kg", "ml", "l", "liter", "litre",
    "extra", "virgin", "fresh", "dried", "whole", "washed", "soaked", "chopped",
    "sliced", "minced", "powder", "powdered", "piece", "pieces", "clove", "cloves",
    "small", "medium", "large", "optional", "to", "taste", "as", "required", "needed",
}


def _norm_text(value):
    text = str(value or "").lower().strip()
    text = re.sub(r"\(.*?\)", " ", text)
    text = re.sub(r"[^a-zA-Z ]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _pick_column(df, candidates):
    cols = {str(c).strip().lower(): c for c in df.columns}
    for name in candidates:
        key = str(name).strip().lower()
        if key in cols:
            return cols[key]
    return None


def _load_nutrition_df():
    try:
        df = pd.read_csv(DATASET_PATH)
    except Exception:
        return pd.DataFrame(columns=["Food Name", "Calories", "Protein", "Carbs", "Fats", "food_norm"])

    df.columns = [str(c).strip() for c in df.columns]

    name_col = _pick_column(df, ["Food Name", "Food", "Name", "Item", "Ingredient"])
    cal_col = _pick_column(df, ["Calories", "Calorie", "Kcal", "Energy"])
    protein_col = _pick_column(df, ["Protein", "Proteins"])
    carbs_col = _pick_column(df, ["Carbs", "Carbohydrate", "Carbohydrates"])
    fat_col = _pick_column(df, ["Fats", "Fat"])

    if name_col is None:
        df["Food Name"] = ""
    else:
        df["Food Name"] = df[name_col].fillna("").astype(str).str.lower().str.strip()

    def to_num(column_name):
        if column_name is None:
            return 0.0
        return pd.to_numeric(df[column_name], errors="coerce").fillna(0.0)

    df["Calories"] = to_num(cal_col)
    df["Protein"] = to_num(protein_col)
    df["Carbs"] = to_num(carbs_col)
    df["Fats"] = to_num(fat_col)
    df["food_norm"] = df["Food Name"].apply(_norm_text)
    return df[["Food Name", "Calories", "Protein", "Carbs", "Fats", "food_norm"]]


nutrition_df = _load_nutrition_df()


def _query_candidates(food_name):
    text = _norm_text(food_name)
    text = ALIASES.get(text, text)
    if not text:
        return []

    candidates = [text]
    tokens = []
    for token in text.split():
        t = token.strip()
        if not t or t in STOPWORDS:
            continue
        if t.endswith("s") and len(t) > 3:
            t = t[:-1]
        tokens.append(t)

    if tokens:
        compact = " ".join(tokens)
        if compact not in candidates:
            candidates.append(compact)
        if len(tokens) >= 2:
            tail = " ".join(tokens[-2:])
            if tail not in candidates:
                candidates.append(tail)
        for token in tokens:
            if len(token) >= 4 and token not in candidates:
                candidates.append(token)

    return candidates


def get_nutrition(food_name):
    try:
        candidates = _query_candidates(food_name)
        match = pd.DataFrame()
        for candidate in candidates:
            match = nutrition_df[nutrition_df["food_norm"].str.contains(candidate, na=False, regex=False)]
            if not match.empty:
                break
        if match.empty:
            return {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0}
        row = match.iloc[0]
        return {
            "calories": float(row.get("Calories", 0) or 0),
            "protein": float(row.get("Protein", 0) or 0),
            "carbs": float(row.get("Carbs", 0) or 0),
            "fat": float(row.get("Fats", 0) or 0),
        }
    except Exception:
        return {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0}
