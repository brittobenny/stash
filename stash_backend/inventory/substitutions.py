import re

SUBSTITUTIONS = {
    "butter": [
        {"name": "ghee", "ratio": 1.0, "note": "1:1 swap"},
        {"name": "oil", "ratio": 0.75, "note": "use 3/4 oil for butter"},
    ],
    "ghee": [
        {"name": "butter", "ratio": 1.0, "note": "1:1 swap"},
    ],
    "milk": [
        {"name": "yogurt", "ratio": 1.0, "note": "1:1 swap"},
        {"name": "cream", "ratio": 0.5, "note": "use half cream + water"},
        {"name": "buttermilk", "ratio": 1.0, "note": "1:1 swap"},
    ],
    "yogurt": [
        {"name": "buttermilk", "ratio": 1.0, "note": "1:1 swap"},
        {"name": "milk", "ratio": 1.0, "note": "1:1 swap"},
    ],
    "cream": [
        {"name": "milk", "ratio": 0.75, "note": "3/4 milk + 1/4 butter"},
    ],
    "egg": [
        {"name": "flaxseed", "ratio": 0.06, "note": "1 tbsp flax + 3 tbsp water per egg"},
        {"name": "yogurt", "ratio": 0.25, "note": "1/4 cup yogurt per egg"},
    ],
    "onion": [
        {"name": "shallot", "ratio": 0.75, "note": "use 3/4 shallot"},
    ],
    "garlic": [
        {"name": "garlic powder", "ratio": 0.12, "note": "1/8 tsp per clove"},
    ],
    "ginger": [
        {"name": "ginger powder", "ratio": 0.25, "note": "1/4 tsp per 1 tbsp fresh"},
    ],
    "tomato": [
        {"name": "tomato paste", "ratio": 0.33, "note": "use 1/3 paste + water"},
    ],
    "chilli": [
        {"name": "chilli powder", "ratio": 0.25, "note": "use 1/4 tsp per 1 chilli"},
    ],
    "chili": [
        {"name": "chilli powder", "ratio": 0.25, "note": "use 1/4 tsp per 1 chili"},
    ],
    "cumin seeds": [
        {"name": "coriander seeds", "ratio": 1.0, "note": "warm spice swap"},
    ],
    "coriander leaves": [
        {"name": "parsley", "ratio": 1.0, "note": "1:1 swap"},
    ],
    "paneer": [
        {"name": "tofu", "ratio": 1.0, "note": "1:1 swap"},
    ],
    "chicken": [
        {"name": "mushroom", "ratio": 1.0, "note": "vegetarian swap"},
    ],
    "rice": [
        {"name": "quinoa", "ratio": 1.0, "note": "1:1 swap"},
    ],
    "wheat flour": [
        {"name": "all purpose flour", "ratio": 1.0, "note": "1:1 swap"},
    ],
    "sugar": [
        {"name": "honey", "ratio": 0.75, "note": "use 3/4 honey"},
    ],
    "lemon": [
        {"name": "vinegar", "ratio": 0.5, "note": "use half amount"},
    ],
    "coconut milk": [
        {"name": "cream", "ratio": 0.75, "note": "dilute with water"},
    ],
    "coconut": [
        {"name": "cashew", "ratio": 1.0, "note": "soak and blend"},
    ],
    "cheese": [
        {"name": "paneer", "ratio": 1.0, "note": "1:1 swap"},
    ],
}


def normalize_name(name: str) -> str:
    value = (name or "").lower().strip()
    value = re.sub(r"[^a-zA-Z ]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def get_substitutions(name: str):
    key = normalize_name(name)
    if not key:
        return []
    return SUBSTITUTIONS.get(key, [])


def find_substitutable_ingredients(missing_names, pantry_set):
    pantry_lookup = {normalize_name(p) for p in pantry_set}
    suggestions = []
    for missing in missing_names:
        options = []
        for option in get_substitutions(missing):
            opt_name = normalize_name(option.get("name"))
            options.append({
                "name": option.get("name"),
                "ratio": option.get("ratio", 1.0),
                "note": option.get("note", ""),
                "pantry_has": opt_name in pantry_lookup,
            })
        if options:
            suggestions.append({
                "ingredient": missing,
                "options": options,
            })
    return suggestions
