from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
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

MATCH_STATUSES = [
    ("suggested", "Suggested"),
    ("pledged", "Pledged"),
    ("accepted", "Accepted"),
    ("declined", "Declined"),
    ("delivered", "Delivered"),
]

DONATION_STATUSES = [
    ("open", "Open"),
    ("pledged", "Pledged"),
    ("accepted", "Accepted"),
    ("declined", "Declined"),
    ("delivered", "Delivered"),
]


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        extra.setdefault("username", email)
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        if extra.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra)


class User(AbstractUser):
    email = models.EmailField(unique=True)
    location = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    is_donor = models.BooleanField(default=True)
    is_receiver = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email

    @property
    def roles(self):
        values = []
        if self.is_donor:
            values.append("donor")
        if self.is_receiver:
            values.append("receiver")
        return values

    @property
    def display_name(self):
        full = self.get_full_name().strip()
        return full or self.email

    @property
    def owned_organization(self):
        try:
            return self.organization
        except Organization.DoesNotExist:
            return None


class Organization(models.Model):
    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name="organization",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=200)
    description = models.TextField()
    location = models.CharField(max_length=100)
    contact_email = models.EmailField()
    contact_phone = models.CharField(max_length=50, blank=True)
    image_url = models.URLField(blank=True)
    image = models.ImageField(upload_to="organizations/", blank=True, null=True)
    address = models.CharField(max_length=255, blank=True)
    name_change_count = models.PositiveSmallIntegerField(default=0)

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
    donor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="donations",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    description = models.TextField()
    location = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=DONATION_STATUSES, default="open")
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
    status = models.CharField(max_length=20, choices=MATCH_STATUSES, default="suggested")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-score"]

    def __str__(self):
        return f"{self.score}% {self.organization.name}"


class Notification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="notifications",
        on_delete=models.CASCADE,
    )
    message = models.CharField(max_length=300)
    link = models.CharField(max_length=200, blank=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.message
