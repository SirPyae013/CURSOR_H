from urllib.parse import quote_plus

from django.conf import settings


def build_map_embed_url(address="", location=""):
    query = ", ".join(
        part.strip()
        for part in (address or "", location or "")
        if part and str(part).strip()
    )
    if not query:
        return ""
    encoded = quote_plus(query)
    key = getattr(settings, "GOOGLE_MAPS_API_KEY", "") or ""
    if key:
        return f"https://www.google.com/maps/embed/v1/place?key={key}&q={encoded}"
    return f"https://maps.google.com/maps?q={encoded}&output=embed"
