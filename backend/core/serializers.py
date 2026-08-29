from rest_framework import serializers

from .models import Donation, DonationItem, Need, Organization


class NeedSerializer(serializers.ModelSerializer):
    remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = Need
        fields = [
            "id",
            "organization",
            "item_name",
            "category",
            "quantity_needed",
            "quantity_received",
            "remaining",
            "urgency",
            "description",
        ]
        read_only_fields = ["id", "organization"]


class OrganizationSerializer(serializers.ModelSerializer):
    needs = NeedSerializer(many=True, read_only=True)

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "description",
            "location",
            "contact_email",
            "contact_phone",
            "image_url",
            "needs",
        ]


class OrganizationSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "description",
            "location",
            "contact_email",
            "contact_phone",
            "image_url",
        ]


class DonationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DonationItem
        fields = [
            "id",
            "item_name",
            "category",
            "quantity",
            "condition",
            "intended_users",
        ]


class DonationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Donation
        fields = ["id", "description", "location", "created_at"]
