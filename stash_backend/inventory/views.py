import csv
import json
import re
import html
from pathlib import Path

from django.db import transaction, models
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from .models import Ingredient, PantryItem, InventoryItem
from .serializers import PantryItemSerializer
from .serializers import InventoryItemSerializer
from .expiry_alerts import sync_expiry_notifications_for_user
from .low_stock import sync_low_stock_notifications_for_user
from .ml.recommender import recommender
from .ml.hero_ingredient_pipeline import is_basic_spice
from nutrition.calculator import calculate_nutrition
from nutrition.services import build_recipe_nutrition_insights
from .substitutions import find_substitutable_ingredients, normalize_name as normalize_sub_name
from urllib.parse import urlparse, quote_plus, unquote
from urllib.request import Request, urlopen
from django.http import HttpResponse, HttpResponseRedirect, FileResponse
from django.conf import settings


def _normalize_ingredient_category(raw_category: str) -> str:
    value = (raw_category or "").strip().lower()
    mapping = {
        "vegetables": "Vegetable",
        "greens": "Vegetable",
        "mushrooms": "Vegetable",
        "vegetable": "Vegetable",
        "fruit": "Fruit",
        "fruits": "Fruit",
        "meat": "Meat",
        "seafood": "Meat",
        "dairy": "Dairy",
        "grain": "Grain",
        "grains": "Grain",
        "spice": "Spice",
        "spices": "Spice",
        "oil": "Oil",
        "oils and sauces": "Oil",
        "other": "Other",
    }
    return mapping.get(value, "Other")


def _seed_ingredients_from_csv_if_empty() -> None:
    """
    Load ingredient master data lazily when DB is empty.
    This keeps first-run environments working without a manual management command.
    """
    csv_path = Path(settings.BASE_DIR) / "data" / "ingredients_master.csv"
    if not csv_path.exists():
        return

    parsed_rows = []
    with open(csv_path, newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            name = (row.get("name") or "").strip()
            if not name:
                continue

            category = _normalize_ingredient_category(row.get("category"))
            default_unit = (row.get("default_unit") or "grams").strip() or "grams"
            image_url = (row.get("image_url") or "").strip() or None

            parsed_rows.append(
                {
                    "name": name,
                    "category": category,
                    "default_unit": default_unit,
                    "image_url": image_url,
                }
            )

    if not parsed_rows:
        return

    embedding_lookup = {}
    try:
        from .ml.embedding_service import generate_embeddings

        embedding_lookup = generate_embeddings([row["name"] for row in parsed_rows])
    except Exception:
        embedding_lookup = {}

    rows = []
    for row in parsed_rows:
        rows.append(
            Ingredient(
                name=row["name"],
                category=row["category"],
                default_unit=row["default_unit"],
                image_url=row["image_url"],
                embedding=embedding_lookup.get((row["name"] or "").strip().lower()),
            )
        )

    # Keep DB aligned with CSV without deleting user-linked rows.
    Ingredient.objects.bulk_create(rows, ignore_conflicts=True)


def _load_master_ingredient_names() -> set[str]:
    csv_path = Path(settings.BASE_DIR) / "data" / "ingredients_master.csv"
    if not csv_path.exists():
        return set()

    names = set()
    with open(csv_path, newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            name = (row.get("name") or "").strip()
            if name:
                names.add(name)
    return names

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_ingredients(request):
    _seed_ingredients_from_csv_if_empty()
    master_names = _load_master_ingredient_names()
    ingredients_qs = Ingredient.objects.order_by("name")
    if master_names:
        ingredients_qs = ingredients_qs.filter(name__in=master_names)
    ingredients = ingredients_qs.values('id', 'name', 'category', 'default_unit', 'image_url')
    return Response(list(ingredients))

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_pantry_item(request):
    ingredient_id = request.data.get("ingredient")
    quantity_raw = request.data.get("quantity")
    expiry_date = request.data.get("expiry_date")
    low_stock_limit_raw = request.data.get("low_stock_limit")

    if not ingredient_id:
        return Response({"error": "ingredient is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        quantity = float(quantity_raw)
    except (TypeError, ValueError):
        return Response({"error": "quantity must be a number"}, status=status.HTTP_400_BAD_REQUEST)

    if quantity <= 0:
        return Response({"error": "quantity must be greater than 0"}, status=status.HTTP_400_BAD_REQUEST)

    if not expiry_date:
        expiry_date = None

    if low_stock_limit_raw in {"", None}:
        low_stock_limit = None
    else:
        try:
            low_stock_limit = float(low_stock_limit_raw)
        except (TypeError, ValueError):
            return Response({"error": "low_stock_limit must be a number"}, status=status.HTTP_400_BAD_REQUEST)
        if low_stock_limit <= 0:
            return Response({"error": "low_stock_limit must be greater than 0"}, status=status.HTTP_400_BAD_REQUEST)

    pantry_item, created = PantryItem.objects.get_or_create(
        user=request.user,
        ingredient_id=ingredient_id,
        defaults={
            "quantity": quantity,
            "expiry_date": expiry_date,
            "low_stock_limit": low_stock_limit,
        }
    )

    if not created:
        pantry_item.quantity += quantity
        pantry_item.expiry_date = expiry_date
        if low_stock_limit is not None:
            pantry_item.low_stock_limit = low_stock_limit
        pantry_item.save()

    sync_expiry_notifications_for_user(request.user)
    sync_low_stock_notifications_for_user(request.user)
    return Response({"message": "Pantry updated successfully"})



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_pantry_items(request):
    sync_expiry_notifications_for_user(request.user)
    sync_low_stock_notifications_for_user(request.user)
    items = PantryItem.objects.filter(user=request.user)
    serializer = PantryItemSerializer(items, many=True)
    return Response(serializer.data)


@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def update_pantry_item(request, pk):
    try:
        item = PantryItem.objects.get(pk=pk, user=request.user)
    except PantryItem.DoesNotExist:
        return Response({"error": "Item not found"}, status=404)

    qty_raw = request.data.get("quantity", item.quantity)
    expiry_date = request.data.get("expiry_date", item.expiry_date)
    low_stock_limit_raw = request.data.get("low_stock_limit", item.low_stock_limit)

    try:
        qty = float(qty_raw)
    except (TypeError, ValueError):
        return Response({"error": "quantity must be a number"}, status=400)

    if qty <= 0:
        return Response({"error": "quantity must be greater than 0"}, status=400)

    if low_stock_limit_raw in {"", None}:
        low_stock_limit = None
    else:
        try:
            low_stock_limit = float(low_stock_limit_raw)
        except (TypeError, ValueError):
            return Response({"error": "low_stock_limit must be a number"}, status=400)
        if low_stock_limit <= 0:
            return Response({"error": "low_stock_limit must be greater than 0"}, status=400)

    item.quantity = qty
    item.expiry_date = expiry_date
    item.low_stock_limit = low_stock_limit
    item.save(update_fields=["quantity", "expiry_date", "low_stock_limit"])
    sync_expiry_notifications_for_user(request.user)
    sync_low_stock_notifications_for_user(request.user)
    return Response(PantryItemSerializer(item).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_to_inventory(request):
    ingredient_id = request.data.get("ingredient")
    quantity = request.data.get("quantity")
    unit = request.data.get("unit")
    expiry_date = request.data.get("expiry_date")

    try:
        ingredient = Ingredient.objects.get(id=ingredient_id)
    except Ingredient.DoesNotExist:
        return Response({"error": "Ingredient not found"}, status=404)

    item, created = InventoryItem.objects.update_or_create(
        user=request.user,
        ingredient=ingredient,
        defaults={
            "quantity": quantity,
            "unit": unit,
            "expiry_date": expiry_date
        }
    )

    serializer = InventoryItemSerializer(item)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def view_inventory(request):
    items = InventoryItem.objects.filter(user=request.user)
    serializer = InventoryItemSerializer(items, many=True)
    return Response(serializer.data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_inventory(request, pk):
    try:
        item = InventoryItem.objects.get(pk=pk, user=request.user)
    except InventoryItem.DoesNotExist:
        return Response({"error": "Item not found"}, status=404)

    serializer = InventoryItemSerializer(item, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)

    return Response(serializer.errors, status=400)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_inventory(request, pk):
    try:
        item = InventoryItem.objects.get(pk=pk, user=request.user)
    except InventoryItem.DoesNotExist:
        return Response({"error": "Item not found"}, status=404)

    item.delete()
    return Response({"message": "Item deleted"})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def recommend_meals(request):
    pantry_items_qs = PantryItem.objects.select_related("ingredient").filter(user=request.user)
    pantry_quantity_lookup = {}
    for pantry_item in pantry_items_qs:
        pantry_name = str(pantry_item.ingredient.name or "").strip().lower()
        if not pantry_name:
            continue
        pantry_quantity_lookup[pantry_name] = pantry_quantity_lookup.get(pantry_name, 0.0) + float(pantry_item.quantity or 0.0)

    if request.method == "POST":
        selected = request.data.get("ingredients") or []
        if isinstance(selected, str):
            selected = [s.strip() for s in selected.split(",")]
        pantry_payload = []
        for item in selected:
            if isinstance(item, dict):
                name = str(item.get("name") or item.get("ingredient") or "").strip().lower()
                if not name:
                    continue
                try:
                    quantity = float(item.get("quantity", 1.0))
                except (TypeError, ValueError):
                    quantity = 0.0
            else:
                name = str(item).strip().lower()
                if not name:
                    continue
                # For name-only selections from UI, use real pantry quantity.
                # Fallback to 0.0 so strict hero quantity checks remain honest.
                quantity = float(pantry_quantity_lookup.get(name, 0.0))
            pantry_payload.append({"name": name, "quantity": max(quantity, 0.0)})
    else:
        pantry_payload = []

    if not pantry_payload:
        pantry_payload = [
            {
                "name": item.ingredient.name.lower(),
                "quantity": float(item.quantity or 0.0),
            }
            for item in pantry_items_qs
        ]

    ingredients = [item["name"] for item in pantry_payload]

    if request.method == "POST":
        top_k_raw = request.data.get("top_k", 10)
        min_match_raw = request.data.get("min_match_percent", 25)
    else:
        top_k_raw = request.query_params.get("top_k", 10)
        min_match_raw = request.query_params.get("min_match_percent", 25)

    try:
        top_k = int(top_k_raw)
    except (TypeError, ValueError):
        top_k = 10
    top_k = max(1, min(10, top_k))

    try:
        min_match_percent = float(min_match_raw)
    except (TypeError, ValueError):
        min_match_percent = 25.0
    min_match_percent = max(0.0, min(100.0, min_match_percent))

    try:
        results = recommender.recommend(
            pantry_payload,
            top_k=top_k,
            min_match_percent=min_match_percent,
        )
    except Exception as exc:
        # Keep API resilient in production while surfacing the issue to logs.
        print(f"Recommendation engine error: {exc}")
        results = []

    # 🔹 Attach high calorie warning
    for recipe in results:
        recipe["high_calorie_warning"] = (
            recipe["nutrition"]["calories"] > 700
        )

    return Response({
        "pantry_items": ingredients,
        "top_k": top_k,
        "min_match_percent": min_match_percent,
        "recommendations": results
    })


SUPPORTED_UNITS = {"g", "grams", "ml", "pcs", "piece"}

def normalize_name(name: str) -> str:
    n = normalize_sub_name(name or "")
    if not n:
        return ""

    phrases_to_remove = [
        "or as needed",
        "as needed",
        "to taste",
        "as required",
        "for garnish",
    ]
    words_to_remove = {
        "optional",
        "fresh",
        "dried",
        "chopped",
        "sliced",
        "minced",
        "whole",
        "stalk",
        "stalks",
        "leaf",
        "leaves",
        "tsp",
        "tbsp",
        "teaspoon",
        "teaspoons",
        "tablespoon",
        "tablespoons",
        "cup",
        "cups",
        "gram",
        "grams",
        "g",
        "kg",
        "ml",
        "liter",
        "liters",
        "piece",
        "pieces",
        "pcs",
        "pinch",
        "pinches",
        "dash",
        "handful",
        "bunch",
        "sprig",
        "sprigs",
    }
    for phrase in phrases_to_remove:
        n = re.sub(rf"\b{re.escape(phrase)}\b", " ", n)
    n = re.sub(r"[-_/]", " ", n)

    tokens = []
    token_fixes = {
        "tomatoes": "tomato",
        "tomatoe": "tomato",
        "chillie": "chilli",
        "chillies": "chilli",
        "chilie": "chilli",
        "chilies": "chilli",
        "reen": "green",
        "inger": "ginger",
        "arlic": "garlic",
    }
    for token in re.split(r"\s+", n):
        t = token.strip()
        if not t or t in {"of", "and", "or", "to", "as", "for"}:
            continue
        if t in words_to_remove:
            continue
        t = token_fixes.get(t, t)
        if t.endswith("s") and len(t) > 3:
            t = t[:-1]
            t = token_fixes.get(t, t)
        if len(t) <= 1:
            continue
        tokens.append(t)

    n = " ".join(tokens).strip()

    aliases = {
        "clove garlic": "garlic",
        "cloves garlic": "garlic",
        "garlic clove": "garlic",
        "garlic cloves": "garlic",
        "tablespoon milk": "milk",
        "tbsp milk": "milk",
        "saltpepper": "salt",
        "salt pepper": "salt",
        "table salt": "salt",
        "sea salt": "salt",
        "kosher salt": "salt",
        "su ar": "sugar",
        "spring onion": "green onion",
        "green onions": "green onion",
        "spring onions": "green onion",
        "scallions": "green onion",
        "red chilli flakes": "chilli flakes",
        "red chili flakes": "chilli flakes",
        "red chili": "red chilli",
        "green chilie": "green chilli",
        "green chilies": "green chilli",
        "inger arlic": "ginger garlic",
        "inger arlic paste": "ginger garlic paste",
    }
    return aliases.get(n, n)

def parse_bool(val) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    if isinstance(val, str):
        return val.strip().lower() in {"1", "true", "yes", "y", "on"}
    return False


def _is_household_spice(name: str) -> bool:
    candidate = normalize_name(name)
    if not candidate:
        return False
    return is_basic_spice(candidate)

def _format_qty(value: float) -> str:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return "0"
    if abs(num - round(num)) < 0.01:
        return str(int(round(num)))
    return f"{num:.2f}".rstrip("0").rstrip(".")

def scale_parsed_ingredients(parsed_ingredients, scale: float):
    if not parsed_ingredients:
        return []
    try:
        scale = float(scale or 1.0)
    except (TypeError, ValueError):
        scale = 1.0
    if scale <= 0:
        scale = 1.0

    scaled = []
    for item in parsed_ingredients:
        name = item.get("name")
        grams = float(item.get("grams") or 0) * scale
        qty = item.get("quantity")
        unit = item.get("unit")
        display = item.get("display")
        scaled_qty = None
        if qty is not None:
            try:
                scaled_qty = float(qty) * scale
            except (TypeError, ValueError):
                scaled_qty = None
        if scaled_qty is not None and unit:
            display = f"{_format_qty(scaled_qty)} {unit}"
        else:
            display = f"{_format_qty(grams)} g"
        scaled.append({
            "name": name,
            "grams": round(grams, 2),
            "quantity": scaled_qty,
            "unit": unit,
            "display": display,
        })
    return scaled

def build_ingredient_status(pantry_items, parsed_ingredients):
    pantry_map = {
        normalize_name(p.ingredient.name): float(p.quantity or 0)
        for p in pantry_items
    }
    status_list = []
    for item in parsed_ingredients:
        ing_name = normalize_name(item.get("name"))
        if not ing_name:
            continue
        needed = float(item.get("grams") or 0)
        have = float(pantry_map.get(ing_name, 0))

        is_spice = _is_household_spice(ing_name)
        effective_have = have

        if is_spice:
            # Treat common household spices as effectively available for UX and matching.
            effective_have = max(have, needed)
            status_value = "have"
        elif have <= 0:
            status_value = "missing"
        elif needed > 0 and have < needed:
            status_value = "partial"
        else:
            status_value = "have"
        status_list.append({
            "name": ing_name,
            "display": item.get("display") or f"{round(needed, 2)} g",
            "quantity": item.get("quantity"),
            "unit": item.get("unit"),
            "needed_g": round(needed, 2),
            "have_g": round(effective_have, 2),
            "status": status_value,
            "short_g": round(max(0.0, needed - effective_have), 2),
            "assumed_available": is_spice,
        })
    return status_list


def _resolve_safe_fallback(fallback: str | None) -> str:
    safe_fallback = "/api/category-image/vegetable/"
    if not fallback:
        return safe_fallback

    fallback = str(fallback).strip()
    if fallback.startswith("/api/category-image/") or fallback.startswith("/api/live-recipe-image/"):
        return fallback
    if fallback.startswith("http"):
        fb_parsed = urlparse(fallback)
        allowed_fallback_domains = {"source.unsplash.com", "images.unsplash.com", "placehold.co"}
        if fb_parsed.netloc in allowed_fallback_domains:
            return fallback
    return safe_fallback


def _translate_text_google(text: str, target_lang: str = "ml", source_lang: str = "en") -> str | None:
    content = str(text or "").strip()
    if not content:
        return ""

    url = (
        "https://translate.googleapis.com/translate_a/single"
        f"?client=gtx&sl={quote_plus(source_lang)}&tl={quote_plus(target_lang)}&dt=t&q={quote_plus(content)}"
    )
    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urlopen(req, timeout=8) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None

    parts = payload[0] if isinstance(payload, list) and payload else []
    translated = []
    for item in parts:
        if isinstance(item, list) and item:
            translated.append(str(item[0] or ""))
    result = "".join(translated).strip()
    return result or None


def _fetch_google_tts_audio(text: str, lang: str = "ml") -> tuple[bytes | None, str]:
    content = str(text or "").strip()
    if not content:
        return None, "empty"

    url = (
        "https://translate.google.com/translate_tts"
        f"?ie=UTF-8&q={quote_plus(content)}&tl={quote_plus(lang)}&client=tw-ob"
    )
    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://translate.google.com/",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urlopen(req, timeout=10) as resp:
            return resp.read(), "ok"
    except Exception:
        return None, "unavailable"


def _decode_image_candidate(raw_value: str) -> str:
    value = str(raw_value or "").strip().strip('"').strip("'")
    if not value:
        return ""
    value = html.unescape(value)
    value = value.replace("\\u003d", "=").replace("\\u0026", "&").replace("\\u002F", "/").replace("\\/", "/")
    value = value.replace("&amp;", "&")
    value = unquote(value)
    return value


def _is_safe_image_candidate(url: str) -> bool:
    if not url:
        return False
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return False
    host = (parsed.hostname or "").lower()
    if not host:
        return False
    if host in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}:
        return False
    if host.endswith(".local") or host.endswith(".internal"):
        return False
    blocked_prefixes = ("10.", "127.", "169.254.", "172.16.", "172.17.", "172.18.", "172.19.", "172.2", "192.168.")
    if host.startswith(blocked_prefixes):
        return False
    lower_path = (parsed.path or "").lower()
    image_exts = (".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif")
    return any(lower_path.endswith(ext) for ext in image_exts) or "googleusercontent.com" in host or "gstatic.com" in host


def _scrape_google_image(query: str) -> str | None:
    search_url = f"https://www.google.com/search?tbm=isch&hl=en&q={quote_plus(query)}"
    req = Request(
        search_url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urlopen(req, timeout=8) as resp:
            body = resp.read().decode("utf-8", errors="ignore")
    except Exception:
        return None

    patterns = [
        r'"ou":"(https?://[^"]+)"',
        r'"(https?:\\\\/\\\\/[^"\\s]+\\.(?:jpe?g|png|webp|avif|gif)[^"\\s]*)"',
        r'"(https?://[^"\\s]+\\.(?:jpe?g|png|webp|avif|gif)[^"\\s]*)"',
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, body, flags=re.IGNORECASE):
            candidate = _decode_image_candidate(match.group(1))
            if _is_safe_image_candidate(candidate):
                return candidate
    return None


def _scrape_bing_image(query: str) -> str | None:
    search_url = f"https://www.bing.com/images/search?q={quote_plus(query)}&form=HDRSC2&first=1"
    req = Request(
        search_url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urlopen(req, timeout=8) as resp:
            body = resp.read().decode("utf-8", errors="ignore")
    except Exception:
        return None

    patterns = [
        r'"murl":"(https?://[^"]+)"',
        r"murl&quot;:&quot;(https?://[^&]+)&quot;",
        r'"(https?://[^"\\s]+\\.(?:jpe?g|png|webp|avif|gif)[^"\\s]*)"',
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, body, flags=re.IGNORECASE):
            candidate = _decode_image_candidate(match.group(1))
            if _is_safe_image_candidate(candidate):
                return candidate
    return None


@api_view(["GET"])
@permission_classes([AllowAny])
def image_proxy(request):
    url = request.query_params.get("url")
    fallback = request.query_params.get("fallback")
    safe_fallback = _resolve_safe_fallback(fallback)

    if not url or not url.startswith("http"):
        return HttpResponseRedirect(safe_fallback)

    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    if not (domain == "archanaskitchen.com" or domain.endswith(".archanaskitchen.com")):
        return HttpResponseRedirect(safe_fallback)

    try:
        req = Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Referer": f"{parsed.scheme}://{parsed.netloc}",
            },
        )
        with urlopen(req, timeout=8) as resp:
            content = resp.read()
            content_type = resp.headers.get("Content-Type", "image/jpeg")
            return HttpResponse(content, content_type=content_type)
    except Exception:
        return HttpResponseRedirect(safe_fallback)


@api_view(["GET"])
@permission_classes([AllowAny])
def live_recipe_image(request):
    query = str(request.query_params.get("q") or "").strip()
    fallback = request.query_params.get("fallback")
    safe_fallback = _resolve_safe_fallback(fallback)

    if not query:
        return HttpResponseRedirect(safe_fallback)

    # Direct scraping mode requested: try Google first, then Bing as resilient fallback.
    candidate = _scrape_google_image(f"{query} plated dish")
    if not candidate:
        candidate = _scrape_bing_image(f"{query} plated dish")

    if not candidate:
        return HttpResponseRedirect(safe_fallback)

    return HttpResponseRedirect(candidate)


@api_view(["GET"])
@permission_classes([AllowAny])
def category_image(request, category):
    name = (category or "").lower().strip()
    mapping = {
        "vegetable": "vegetables.jpg",
        "vegetables": "vegetables.jpg",
        "grain": "grains.jpg",
        "grains": "grains.jpg",
        "dairy": "diary.jpg",
        "diary": "diary.jpg",
        "meat": "meat.jpg",
        "spice": "spice.jpg",
        "spices": "spice.jpg",
    }
    filename = mapping.get(name)
    if not filename:
        return Response({"error": "Category image not found"}, status=404)

    base_dir = Path(settings.BASE_DIR) / "data"
    file_path = base_dir / filename
    if not file_path.exists():
        return Response({"error": "Image file missing"}, status=404)

    return FileResponse(open(file_path, "rb"), content_type="image/jpeg")


@api_view(["GET"])
@permission_classes([AllowAny])
def doodle_image(request):
    file_path = Path(settings.BASE_DIR) / "data" / "doodle.jpg"
    if not file_path.exists():
        return Response({"error": "Doodle image missing"}, status=404)
    return FileResponse(open(file_path, "rb"), content_type="image/jpeg")


@api_view(["GET"])
@permission_classes([AllowAny])
def auth_background(request):
    file_path = Path(settings.BASE_DIR) / "data" / "background.jpg"
    if not file_path.exists():
        return Response({"error": "Background image missing"}, status=404)
    return FileResponse(open(file_path, "rb"), content_type="image/jpeg")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def translate_recipe_steps(request):
    steps = request.data.get("steps") or []
    target_lang = str(request.data.get("target_lang") or "ml").strip().lower()
    source_lang = str(request.data.get("source_lang") or "en").strip().lower()

    if not isinstance(steps, list):
        return Response({"error": "steps must be a list"}, status=status.HTTP_400_BAD_REQUEST)

    clean_steps = [str(step or "").strip() for step in steps if str(step or "").strip()]
    if not clean_steps:
        return Response({"translated_steps": [], "target_lang": target_lang, "source_lang": source_lang})

    translated_steps = []
    success = True
    for step in clean_steps:
        translated = _translate_text_google(step, target_lang=target_lang, source_lang=source_lang)
        if translated is None:
            success = False
            translated_steps.append(step)
        else:
            translated_steps.append(translated)

    return Response(
        {
            "translated_steps": translated_steps,
            "target_lang": target_lang,
            "source_lang": source_lang,
            "translated": success,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recipe_step_tts(request):
    text = str(request.query_params.get("text") or "").strip()
    lang = str(request.query_params.get("lang") or "ml").strip().lower()

    if not text:
        return Response({"error": "text is required"}, status=status.HTTP_400_BAD_REQUEST)

    if len(text) > 400:
        text = text[:400]

    audio_bytes, status_text = _fetch_google_tts_audio(text, lang=lang)
    if not audio_bytes:
        return Response({"error": f"tts_{status_text}"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    return HttpResponse(audio_bytes, content_type="audio/mpeg")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recipe_detail(request, recipe_id):
    recipe = recommender.get_by_id(recipe_id)
    if not recipe:
        return Response({"error": "Recipe not found"}, status=status.HTTP_404_NOT_FOUND)

    scale_raw = request.query_params.get("scale")
    try:
        scale = float(scale_raw) if scale_raw is not None else 1.0
    except (TypeError, ValueError):
        scale = 1.0
    if scale <= 0:
        scale = 1.0
    if scale < 0.25:
        scale = 0.25
    if scale > 4.0:
        scale = 4.0

    pantry_items = PantryItem.objects.select_related("ingredient").filter(user=request.user)
    scaled_ingredients = scale_parsed_ingredients(recipe.get("parsed_ingredients", []), scale)
    status_list = build_ingredient_status(pantry_items, scaled_ingredients)

    pantry_names = [normalize_name(p.ingredient.name) for p in pantry_items]
    available = {
        item["name"]
        for item in status_list
        if item.get("status") in {"have", "partial"} and item.get("name")
    }
    missing = {item["name"] for item in status_list if item.get("status") == "missing" and item.get("name")}
    insufficient = {item["name"] for item in status_list if item.get("status") == "partial" and item.get("name")}

    recipe["available_ingredients"] = sorted(list(available))
    recipe["missing_ingredients"] = sorted(list(missing))
    recipe["insufficient_ingredients"] = sorted(list(insufficient))
    recipe["ingredient_status"] = status_list
    recipe["parsed_ingredients"] = scaled_ingredients
    recipe["nutrition"] = calculate_nutrition(scaled_ingredients)
    nutrition_insights = build_recipe_nutrition_insights(recipe["nutrition"])
    recipe["nutrition_insights"] = nutrition_insights
    recipe["nutrition_badges"] = nutrition_insights.get("badges", [])
    recipe["nutrition_score"] = nutrition_insights.get("score", 0)
    recipe["scale"] = scale
    recipe["substitution_suggestions"] = find_substitutable_ingredients(recipe["missing_ingredients"], pantry_names)

    return Response(recipe)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cook_recipe(request):
    """
    Body:
    {
      "recipe_id": 961,
      "allow_partial": true   // optional (default false)
    }
    """
    recipe_id = request.data.get("recipe_id")
    if recipe_id is None:
        return Response({"error": "recipe_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    allow_partial = parse_bool(request.data.get("allow_partial", False))
    scale_raw = request.data.get("scale")
    try:
        scale = float(scale_raw) if scale_raw is not None else 1.0
    except (TypeError, ValueError):
        scale = 1.0
    if scale <= 0:
        scale = 1.0
    if scale < 0.25:
        scale = 0.25
    if scale > 4.0:
        scale = 4.0

    pantry_items = PantryItem.objects.select_related("ingredient").filter(user=request.user)
    pantry_names = [normalize_name(p.ingredient.name) for p in pantry_items]

    recipe = recommender.get_by_id(recipe_id)
    if not recipe:
        return Response({"error": "Recipe not found"}, status=status.HTTP_404_NOT_FOUND)

    override_ingredients = request.data.get("ingredients")
    if override_ingredients:
        parsed_ingredients = []
        for item in override_ingredients:
            try:
                name = str(item.get("name") or "")
                grams = float(item.get("grams") or 0)
            except Exception:
                continue
            if not name or grams <= 0:
                continue
            parsed_ingredients.append({"name": name, "grams": grams})
    else:
        parsed_ingredients = scale_parsed_ingredients(recipe.get("parsed_ingredients", []), scale)

    if not parsed_ingredients:
        return Response({"error": "No parsed_ingredients found for this recipe"}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        # Lock pantry rows
        locked_pantry = {
            normalize_name(p.ingredient.name): p
            for p in PantryItem.objects.select_for_update().select_related("ingredient").filter(user=request.user)
        }

        # -------------------------
        # PASS 1: CHECK ONLY
        # -------------------------
        insufficient = []
        plan = []  # (pantry_obj, amount_to_use)

        for item in parsed_ingredients:
            ing_name = normalize_name(item.get("name"))
            needed = float(item.get("grams") or 0)

            if not ing_name or needed <= 0:
                continue
            if _is_household_spice(ing_name):
                # Household spices are considered available and are not deducted.
                continue

            pantry_obj = locked_pantry.get(ing_name)
            have = float(pantry_obj.quantity) if pantry_obj else 0.0

            if have <= 0:
                insufficient.append({"ingredient": ing_name, "needed": needed, "have": have})
                continue

            if have < needed:
                insufficient.append({"ingredient": ing_name, "needed": needed, "have": have})
                if allow_partial:
                    plan.append((pantry_obj, have))  # use whatever is available
                # if strict -> do nothing
                continue

            # have >= needed
            plan.append((pantry_obj, needed))

        # STRICT MODE: if anything missing, do NOT deduct
        if insufficient and not allow_partial:
            return Response(
                {"status": "failed", "reason": "insufficient_pantry", "insufficient": insufficient},
                status=status.HTTP_400_BAD_REQUEST
            )

        # -------------------------
        # PASS 2: DEDUCT (allowed)
        # -------------------------
        deducted = []
        for pantry_obj, use_amt in plan:
            if pantry_obj is None or use_amt <= 0:
                continue
            pantry_obj.quantity = float(pantry_obj.quantity) - float(use_amt)
            pantry_obj.save(update_fields=["quantity"])
            deducted.append({"ingredient": pantry_obj.ingredient.name, "used_g": float(use_amt)})

            inv_item, _ = InventoryItem.objects.get_or_create(
                user=request.user,
                ingredient=pantry_obj.ingredient,
                defaults={"quantity": 0, "unit": pantry_obj.ingredient.default_unit}
            )
            inv_item.quantity = float(inv_item.quantity or 0) + float(use_amt)
            inv_item.unit = pantry_obj.ingredient.default_unit
            inv_item.save(update_fields=["quantity", "unit"])

        PantryItem.objects.filter(user=request.user, quantity__lte=0.0001).delete()

    sync_expiry_notifications_for_user(request.user)
    sync_low_stock_notifications_for_user(request.user)
    nutrition_totals = calculate_nutrition(parsed_ingredients)
    cook_nutrition_insights = build_recipe_nutrition_insights(nutrition_totals)
    nutrition_scoring = None
    try:
        from nutrition.services import record_cooked_recipe

        nutrition_scoring = record_cooked_recipe(
            user=request.user,
            recipe_id=recipe["id"],
            recipe_name=recipe["name"],
            nutrition_totals=nutrition_totals,
            parsed_ingredients=parsed_ingredients,
        )
    except Exception:
        # Do not fail cooking flow if nutrition scoring fails unexpectedly.
        nutrition_scoring = None

    return Response(
        {
            "status": "partial" if insufficient else "success",
            "allow_partial": allow_partial,
            "scale": scale,
            "cooked_recipe": {"id": recipe["id"], "name": recipe["name"]},
            "deducted": deducted,
            "missing": insufficient,
            "nutrition": nutrition_totals,
            "nutrition_insights": cook_nutrition_insights,
            "nutrition_scoring": nutrition_scoring,
        },
        status=status.HTTP_200_OK
    )
