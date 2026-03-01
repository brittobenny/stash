import re
from nutrition.conversions import (
    UNIT_TO_GRAMS,
    DEFAULT_INGREDIENT_GRAMS,
    PIECE_TO_GRAMS,
)

try:
    from nutrition.conversions import INCH_TO_GRAMS_BY_INGREDIENT, CM_TO_GRAMS_BY_INGREDIENT
except Exception:
    INCH_TO_GRAMS_BY_INGREDIENT = {}
    CM_TO_GRAMS_BY_INGREDIENT = {}

UNICODE_FRACTIONS = {
    "¼": 0.25, "½": 0.5, "¾": 0.75,
    "⅓": 1/3,  "⅔": 2/3,
    "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
}


def _to_number(qty_str: str) -> float:
    qty_str = qty_str.strip()

    if qty_str in UNICODE_FRACTIONS:
        return float(UNICODE_FRACTIONS[qty_str])

    # "1 1/2"
    m = re.match(r"^(\d+)\s+(\d+)\s*/\s*(\d+)$", qty_str)
    if m:
        whole = float(m.group(1))
        num = float(m.group(2))
        den = float(m.group(3))
        return whole + (num / den)

    # "1/4"
    m = re.match(r"^(\d+)\s*/\s*(\d+)$", qty_str)
    if m:
        return float(m.group(1)) / float(m.group(2))

    return float(qty_str)


def _normalize_unit(unit: str) -> str:
    u = (unit or "").lower().strip()
    u = u.replace("tsp", "teaspoon")
    u = u.replace("tbsp", "tablespoon")
    u = u.replace("teaspoons", "teaspoon")
    u = u.replace("tablespoons", "tablespoon")
    u = u.replace("cups", "cup")
    u = u.replace("pieces", "piece")
    u = u.replace("pcs", "piece")
    u = u.replace("pc", "piece")
    u = u.replace("liters", "liter")
    u = u.replace("inches", "inch")
    return u


def _clean_name(name: str) -> str:
    name = (name or "").lower().strip()

    # remove (jeera), (besan)...
    name = re.sub(r"\(.*?\)", "", name)

    # remove common notes
    name = re.sub(
        r"\b(or as needed|as needed|to taste|optional|for garnish|as required|required|finely chopped|thinly sliced|sliced|chopped|pinch|pinches|dash|sprig|sprigs|handful|bunch)\b",
        "",
        name,
    )

    # keep left part before "-" (often notes after it)
    name = name.split("-")[0].strip()

    # normalize separators
    name = name.replace("/", " ")
    name = name.replace("saltpepper", "salt pepper")
    name = name.replace("salt & pepper", "salt pepper")
    name = name.replace("salt and pepper", "salt pepper")
    name = name.replace("pepper and salt", "salt pepper")

    # remove non letters
    name = re.sub(r"[^a-zA-Z ]", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    tokens = [t for t in name.split() if len(t) > 1]
    name = " ".join(tokens).strip()

    aliases = {
        "salt pepper": "salt",
        "tablespoon milk": "milk",
        "tbsp milk": "milk",
        "su ar": "sugar",
        "ye ast": "yeast",
        "ses ame": "sesame",
        "tomatoe": "tomato",
        "tomatoes": "tomato",
        "chillie": "chilli",
        "chillies": "chilli",
        "chilie": "chilli",
        "chilies": "chilli",
        "green chillie": "green chilli",
        "green chillies": "green chilli",
        "green chilie": "green chilli",
        "green chilies": "green chilli",
        "inger arlic paste": "ginger garlic paste",
    }
    return aliases.get(name, name)




def _guess_default_grams(clean_name: str) -> float:
    for key in sorted(DEFAULT_INGREDIENT_GRAMS.keys(), key=len, reverse=True):
        if key in clean_name:
            return float(DEFAULT_INGREDIENT_GRAMS[key])
    return 30.0


def _grams_for_length_unit(qty: float, unit: str, clean_name: str) -> float:
    u = _normalize_unit(unit)
    if u == "inch":
        for key in sorted(INCH_TO_GRAMS_BY_INGREDIENT.keys(), key=len, reverse=True):
            if key in clean_name:
                return qty * float(INCH_TO_GRAMS_BY_INGREDIENT[key])
        return qty * 6.0  # fallback
    if u == "cm":
        for key in sorted(CM_TO_GRAMS_BY_INGREDIENT.keys(), key=len, reverse=True):
            if key in clean_name:
                return qty * float(CM_TO_GRAMS_BY_INGREDIENT[key])
        return qty * 2.4  # fallback
    return -1.0


def _grams_for_piece(qty: float, clean_name: str):
    """
    If string looks like "1 onion" (qty exists, unit missing),
    treat it as pieces using PIECE_TO_GRAMS mapping.
    """
    # normalize plurals for matching
    singularish = clean_name
    if singularish.endswith("s") and len(singularish) > 3:
        singularish = singularish[:-1]

    # longest keys first
    for key in sorted(PIECE_TO_GRAMS.keys(), key=len, reverse=True):
        k = key.lower().strip()
        if k in singularish:
            return qty * float(PIECE_TO_GRAMS[key])

    return None


def parse_ingredient(text: str):
    raw = (text or "").strip().lower()
    if not raw:
        return {"name": "", "grams": 0.0, "quantity": None, "unit": None, "display": ""}

    raw = raw.replace("\u00a0", " ")
    raw = re.sub(r"\s+", " ", raw).strip()
    # Handle malformed compact grams like "100gchicken" -> "100 g chicken".
    raw = re.sub(r"(?<=\d)g(?=[a-z])", " g ", raw)

    # Handle malformed tokens like "tablespoonmilk" -> "tablespoon milk".
    # Keep single-letter 'g' out of this pattern so words like "green" stay intact.
    raw = re.sub(
        r"\b(teaspoons?|tsp|tablespoons?|tbsp|cups?|gram|grams|kg|ml|liter|liters|pieces?|piece|pcs|inch|inches|cm)(?=[a-z])",
        r"\1 ",
        raw,
    )

    # 1) quantity at start (supports fractions/unicode)
    qty_match = re.match(
        r"^\s*(\d+\s+\d+\s*/\s*\d+|\d+\s*/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:\.\d+)?)\s*(.*)$",
        raw,
    )

    qty = None
    rest = raw
    if qty_match:
        qty = _to_number(qty_match.group(1))
        rest = qty_match.group(2).strip()

    # 2) unit at start of remainder (includes inch/cm)
    unit_match = re.match(
        r"^(teaspoons?|tsp|tablespoons?|tbsp|cups?|gram|grams|g|kg|ml|liter|liters|pieces?|piece|pcs|inch|inches|cm)(?:\s+|$)(.*)$",
        rest,
    )

    unit = None
    name_part = rest
    raw_unit = None
    if unit_match:
        raw_unit = unit_match.group(1)
        unit = raw_unit
        name_part = unit_match.group(2).strip()

    clean_name = _clean_name(name_part)

    # 3) no qty -> defaults
    if qty is None:
        grams = round(_guess_default_grams(clean_name), 2)
        return {"name": clean_name, "grams": grams, "quantity": None, "unit": None, "display": f"{grams} g"}

    # 4) inch/cm conversion
    if unit:
        length_grams = _grams_for_length_unit(qty, unit, clean_name)
        if length_grams >= 0:
            grams = round(float(length_grams), 2)
            return {
                "name": clean_name,
                "grams": grams,
                "quantity": qty,
                "unit": _normalize_unit(unit),
                "display": f"{qty} {raw_unit or unit}"
            }

    # ✅ 5) qty exists but unit missing -> treat as pieces if possible
    if not unit:
        unit_in_name = re.match(
            r"^(teaspoons?|tsp|tablespoons?|tbsp|cups?|gram|grams|g|kg|ml|liter|liters|pieces?|piece|pcs|inch|inches|cm)\s+(.+)$",
            clean_name,
        )
        if unit_in_name:
            raw_unit = unit_in_name.group(1)
            unit = raw_unit
            clean_name = _clean_name(unit_in_name.group(2))

    if not unit:
        piece_grams = _grams_for_piece(qty, clean_name)
        if piece_grams is not None:
            grams = round(float(piece_grams), 2)
            return {"name": clean_name, "grams": grams, "quantity": qty, "unit": "piece", "display": f"{qty} pcs"}
        # otherwise assume grams
        grams = round(float(qty), 2)
        return {"name": clean_name, "grams": grams, "quantity": qty, "unit": "gram", "display": f"{qty} g"}

    # 6) normal unit conversion
    u = _normalize_unit(unit)
    grams = qty * float(UNIT_TO_GRAMS.get(u, 1))
    return {
        "name": clean_name,
        "grams": round(float(grams), 2),
        "quantity": qty,
        "unit": u,
        "display": f"{qty} {raw_unit or unit}"
    }
