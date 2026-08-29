import json
import re

from django.conf import settings

CATEGORIES = {
    "clothing",
    "education",
    "school_supplies",
    "food",
    "hygiene",
    "toys",
    "household",
    "shoes",
    "blankets",
    "other",
}

EXTRACT_SYSTEM = """You extract donation items for a matching app. Return JSON only:
{ "items": [ { "item_name": string, "category": one of [clothing, education, school_supplies, food, hygiene, toys, household, shoes, blankets, other], "quantity": number, "intended_users": string, "condition": string|null } ] }
Rules: split distinct items; infer category; quantity integer, default 1 if vague ("several" → 5); never add items not in the text."""

EXPLAIN_SYSTEM = """Write 2–3 sentences for a donor explaining why this organization is a good match.
Use only the JSON facts provided. Mention the strongest matching needs, urgency, and whether the city matches.
Do not invent programs, numbers, or outcomes not in the input. Do not mention other organizations."""

KEYWORD_MAP = [
    (("notebook", "notebooks", "pencil", "pencils", "stationery"), "school_supplies"),
    (("textbook", "textbooks", "book", "books"), "education"),
    (("shirt", "shirts", "clothes", "clothing", "uniform", "uniforms", "dress", "jacket", "jackets"), "clothing"),
    (("food", "rice", "meal", "meals", "groceries"), "food"),
    (("soap", "hygiene", "toothbrush", "toothpaste", "sanitizer"), "hygiene"),
    (("toy", "toys", "doll", "game"), "toys"),
    (("blanket", "blankets"), "blankets"),
    (("shoe", "shoes", "sandals"), "shoes"),
    (("pot", "pans", "household", "utensil"), "household"),
]


def _has_keyword(text, keywords):
    for keyword in keywords:
        if re.search(rf"\b{re.escape(keyword)}\b", text):
            return True
    return False


def _normalize_item(raw):
    category = (raw.get("category") or "other").strip().lower().replace(" ", "_")
    if category not in CATEGORIES:
        category = "other"
    try:
        quantity = int(raw.get("quantity") or 1)
    except (TypeError, ValueError):
        quantity = 1
    quantity = max(1, quantity)
    condition = raw.get("condition")
    if condition in ("", "null", None):
        condition = None
    return {
        "item_name": (raw.get("item_name") or "item").strip()[:200],
        "category": category,
        "quantity": quantity,
        "intended_users": (raw.get("intended_users") or "")[:200],
        "condition": condition,
    }


def fallback_extract(description):
    """Keyword + quantity extractor so the demo still works without OpenAI."""
    chunks = re.split(r",|\band\b", description, flags=re.I)
    items = []
    for chunk in chunks:
        text = chunk.strip()
        if not text:
            continue
        qty_match = re.search(r"(\d+)", text)
        quantity = int(qty_match.group(1)) if qty_match else 5 if re.search(r"several|some|few", text, re.I) else 1
        lowered = text.lower()
        category = "other"
        for keywords, cat in KEYWORD_MAP:
            if _has_keyword(lowered, keywords):
                category = cat
                break
        name = re.sub(r"^(i have|we have|donating)\s+", "", text, flags=re.I)
        name = re.sub(r"^\d+\s+", "", name).strip(" .")
        if not name:
            continue
        items.append(
            _normalize_item(
                {
                    "item_name": name,
                    "category": category,
                    "quantity": quantity,
                    "intended_users": "",
                    "condition": None,
                }
            )
        )
    return items or [
        _normalize_item(
            {"item_name": description[:80], "category": "other", "quantity": 1}
        )
    ]


def extract_items(description):
    api_key = getattr(settings, "OPENAI_API_KEY", "") or ""
    if not api_key:
        return fallback_extract(description)
    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key, timeout=12.0)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            temperature=0,
            messages=[
                {"role": "system", "content": EXTRACT_SYSTEM},
                {"role": "user", "content": description},
            ],
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        items = [_normalize_item(item) for item in payload.get("items") or []]
        return items or fallback_extract(description)
    except Exception:
        return fallback_extract(description)


def explain_match(facts):
    api_key = getattr(settings, "OPENAI_API_KEY", "") or ""
    if not api_key:
        return None
    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key, timeout=12.0)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.3,
            messages=[
                {"role": "system", "content": EXPLAIN_SYSTEM},
                {"role": "user", "content": json.dumps(facts)},
            ],
        )
        text = (response.choices[0].message.content or "").strip()
        return text or None
    except Exception:
        return None


def template_reason(org, scored, donation_location):
    strong = [
        im["need_name"]
        for im in scored["item_matches"]
        if im.get("need_name") and im["status"] in ("strong", "partial")
    ]
    needs_text = ", ".join(strong) if strong else "items you described"
    nearby = org.location.lower() == donation_location.lower()
    place = "located nearby" if nearby else f"based in {org.location}"
    urgency = scored.get("highest_urgency", "medium")
    return (
        f"{org.name} is a strong match because they currently need {needs_text}. "
        f"Several of those needs are {urgency} urgency, and the organization is {place}."
    )
