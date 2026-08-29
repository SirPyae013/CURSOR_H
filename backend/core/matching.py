import re

RELATED_CATEGORIES = {
    ("education", "school_supplies"),
    ("school_supplies", "education"),
    ("clothing", "shoes"),
    ("shoes", "clothing"),
}

STOPWORDS = {
    "a",
    "an",
    "the",
    "of",
    "and",
    "for",
    "to",
    "in",
    "with",
    "school",
    "item",
    "items",
}

URGENCY_SCORE = {"high": 1.0, "medium": 0.6, "low": 0.3}

IMPACT_LABELS = {
    "clothing": "students receive clothing",
    "education": "students receive textbooks",
    "school_supplies": "students receive notebooks",
    "shoes": "children receive shoes",
    "toys": "children receive toys",
    "food": "people receive meals",
    "hygiene": "people receive hygiene supplies",
    "blankets": "people receive blankets",
    "household": "families receive household items",
    "other": "people receive needed items",
}


def tokenize(name):
    words = re.findall(r"[a-z0-9]+", (name or "").lower())
    return {w for w in words if w not in STOPWORDS and len(w) > 2}


def item_need_score(donation_item, need):
    dcat = donation_item["category"]
    ncat = need.category
    overlap = tokenize(donation_item["item_name"]) & tokenize(need.item_name)
    if dcat == ncat and overlap:
        return 1.0
    if dcat == ncat:
        return 0.65
    if (dcat, ncat) in RELATED_CATEGORIES:
        return 0.4
    return 0.0


def _status(score):
    if score >= 1.0:
        return "strong"
    if score > 0:
        return "partial"
    return "none"


def score_organization(donation_items, org, donation_location):
    needs = list(org.needs.all())
    if not donation_items:
        return {
            "score": 0,
            "breakdown": {"item": 0, "urgency": 0, "location": 0, "quantity": 0},
            "item_matches": [],
            "impact": [],
            "highest_urgency": "low",
        }

    item_scores = []
    item_matches = []
    impact = []
    matched_pairs = []

    for item in donation_items:
        best_need = None
        best_score = 0.0
        for need in needs:
            s = item_need_score(item, need)
            if s > best_score:
                best_score = s
                best_need = need
        item_scores.append(best_score)
        status = _status(best_score)
        item_matches.append(
            {
                "item_name": item["item_name"],
                "status": status,
                "need_name": best_need.item_name if best_need and best_score > 0 else None,
                "need_id": best_need.id if best_need and best_score > 0 else None,
                "score": round(best_score, 2),
            }
        )
        if best_need and best_score >= 0.4:
            matched_pairs.append((item, best_need, best_score))
            count = min(int(item["quantity"]), best_need.remaining)
            if count > 0:
                label = IMPACT_LABELS.get(item["category"], IMPACT_LABELS["other"])
                impact.append(
                    {
                        "label": label,
                        "count": count,
                        "item_name": item["item_name"],
                    }
                )

    item_avg = sum(item_scores) / len(item_scores)
    urgency_vals = [
        URGENCY_SCORE.get(need.urgency, 0)
        for item, need, score in matched_pairs
        if score >= 0.65
    ]
    urgency_avg = max(urgency_vals) if urgency_vals else 0.0
    location_score = (
        1.0 if org.location.strip().lower() == donation_location.strip().lower() else 0.25
    )

    qty_scores = []
    for item, need, score in matched_pairs:
        donated = max(1, int(item["quantity"]))
        if need.remaining <= 0:
            qty_scores.append(0.0)
        else:
            qty_scores.append(min(donated, need.remaining) / donated)
    quantity_avg = sum(qty_scores) / len(qty_scores) if qty_scores else 0.0

    total = round(
        100 * (0.5 * item_avg + 0.2 * urgency_avg + 0.15 * location_score + 0.15 * quantity_avg)
    )

    urgency_rank = {"high": 3, "medium": 2, "low": 1}
    highest = "low"
    for _item, need, score in matched_pairs:
        if score >= 0.65 and urgency_rank.get(need.urgency, 0) > urgency_rank.get(highest, 0):
            highest = need.urgency
    if highest == "low":
        for need in needs:
            if urgency_rank.get(need.urgency, 0) > urgency_rank.get(highest, 0):
                highest = need.urgency

    return {
        "score": total,
        "breakdown": {
            "item": round(item_avg, 2),
            "urgency": round(urgency_avg, 2),
            "location": round(location_score, 2),
            "quantity": round(quantity_avg, 2),
        },
        "item_matches": item_matches,
        "impact": impact,
        "highest_urgency": highest,
    }
