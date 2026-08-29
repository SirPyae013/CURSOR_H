from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Donation, DonationItem, Need, Organization

User = get_user_model()


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
        read_only_fields = ["id"]


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
        fields = ["id", "description", "location", "created_at", "donor"]
        read_only_fields = ["id", "created_at", "donor"]


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.ListField(child=serializers.CharField(), read_only=True)
    name = serializers.CharField(source="display_name", read_only=True)
    organization = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "name",
            "first_name",
            "last_name",
            "location",
            "phone",
            "is_donor",
            "is_receiver",
            "roles",
            "organization",
        ]
        read_only_fields = [
            "id",
            "email",
            "name",
            "is_donor",
            "is_receiver",
            "roles",
            "organization",
        ]

    def get_organization(self, user):
        org = user.owned_organization
        if not org:
            return None
        return OrganizationSummarySerializer(org).data


class ProfileUpdateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = User
        fields = ["name", "first_name", "last_name", "location", "phone"]

    def validate(self, attrs):
        name = attrs.pop("name", None)
        if name:
            parts = name.split(None, 1)
            attrs["first_name"] = parts[0]
            attrs["last_name"] = parts[1] if len(parts) > 1 else ""
        return attrs


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    name = serializers.CharField(max_length=150)
    location = serializers.CharField(max_length=100, required=False, allow_blank=True)
    become_receiver = serializers.BooleanField(required=False, default=False)

    def validate_email(self, value):
        email = value.lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        name = validated_data["name"].strip()
        parts = name.split(None, 1)
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=parts[0],
            last_name=parts[1] if len(parts) > 1 else "",
            location=validated_data.get("location", ""),
            is_donor=True,
            is_receiver=bool(validated_data.get("become_receiver")),
        )


class RoleTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["roles"] = user.roles
        token["email"] = user.email
        token["user_id"] = user.id
        return token
