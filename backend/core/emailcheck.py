from django.core.exceptions import ValidationError
from django.core.validators import EmailValidator

from django.contrib.auth import get_user_model

User = get_user_model()

TYPO_DOMAINS = {
    "gmial.com": "gmail.com",
    "gmal.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gnail.com": "gmail.com",
    "gmai.com": "gmail.com",
    "gmail.co": "gmail.com",
    "gmail.cm": "gmail.com",
    "yaho.com": "yahoo.com",
    "yahooo.com": "yahoo.com",
    "yhoo.com": "yahoo.com",
    "yahoo.co": "yahoo.com",
    "hotmal.com": "hotmail.com",
    "hotmial.com": "hotmail.com",
    "outlok.com": "outlook.com",
    "outloo.com": "outlook.com",
}


def suggest_email(email):
    if "@" not in email:
        return None
    local, domain = email.rsplit("@", 1)
    fixed = TYPO_DOMAINS.get(domain.lower())
    if not fixed:
        return None
    return f"{local}@{fixed}"


def check_email_address(raw):
    email = (raw or "").strip()
    payload = {"available": False, "valid": False, "suggestion": None}
    if not email:
        return payload
    try:
        EmailValidator()(email)
    except ValidationError:
        payload["suggestion"] = suggest_email(email)
        return payload
    payload["valid"] = True
    payload["suggestion"] = suggest_email(email)
    payload["available"] = not User.objects.filter(email__iexact=email).exists()
    return payload
