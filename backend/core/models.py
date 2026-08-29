from django.db import models

CATEGORIES = [
    ("clothing", "Clothing"),
    ("education", "Education"),
    ("school_supplies", "School supplies"),
    ("food", "Food"),
    ("hygiene", "Hygiene"),
    ("toys", "Toys"),
    ("household", "Household"),
    ("shoes", "Shoes"),
    ("blankets", "Blankets"),
    ("other", "Other"),
]

URGENCY_CHOICES = [
    ("high", "High"),
    ("medium", "Medium"),
    ("low", "Low"),
]


class Organization(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField()
    location = models.CharField(max_length=100)
    contact_email = models.EmailField()
    contact_phone = models.CharField(max_length=50, blank=True)
    image_url = models.URLField(blank=True)

    def __str__(self):
        return self.name


class Need(models.Model):
    organization = models.ForeignKey(
        Organization, related_name="needs", on_delete=models.CASCADE
    )
    item_name = models.CharField(max_length=200)
    category = models.CharField(max_length=50, choices=CATEGORIES)
    quantity_needed = models.PositiveIntegerField()
    quantity_received = models.PositiveIntegerField(default=0)
    urgency = models.CharField(max_length=10, choices=URGENCY_CHOICES, default="medium")
    description = models.TextField(blank=True)

    @property
    def remaining(self):
        return max(0, self.quantity_needed - self.quantity_received)

    def __str__(self):
        return f"{self.item_name} ({self.organization.name})"


class Donation(models.Model):
    description = models.TextField()
    location = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Donation {self.id} — {self.location}"


class DonationItem(models.Model):
    donation = models.ForeignKey(
        Donation, related_name="items", on_delete=models.CASCADE
    )
    item_name = models.CharField(max_length=200)
    category = models.CharField(max_length=50, choices=CATEGORIES)
    quantity = models.PositiveIntegerField(default=1)
    condition = models.CharField(max_length=100, blank=True, null=True)
    intended_users = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return f"{self.quantity} × {self.item_name}"


class Match(models.Model):
    donation = models.ForeignKey(
        Donation, related_name="matches", on_delete=models.CASCADE
    )
    organization = models.ForeignKey(
        Organization, related_name="matches", on_delete=models.CASCADE
    )
    score = models.IntegerField()
    reason = models.TextField()
    breakdown = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-score"]

    def __str__(self):
        return f"{self.score}% {self.organization.name}"
