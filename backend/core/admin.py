from django.contrib import admin

from .models import Donation, Need, Organization, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ["email", "first_name", "last_name", "is_donor", "is_receiver", "is_staff"]
    search_fields = ["email", "first_name", "last_name"]
    list_filter = ["is_donor", "is_receiver", "is_staff"]
    exclude = ["username"]


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "location", "contact_email", "owner", "name_change_count"]
    search_fields = ["name", "location", "contact_email"]
    list_filter = ["location"]


@admin.register(Need)
class NeedAdmin(admin.ModelAdmin):
    list_display = ["item_name", "organization", "quantity_needed", "quantity_received", "urgency"]
    list_filter = ["urgency", "category"]


@admin.register(Donation)
class DonationAdmin(admin.ModelAdmin):
    list_display = ["id", "donor", "location", "status", "created_at"]
    list_filter = ["status"]
