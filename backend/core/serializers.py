from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .maps import build_map_embed_url
from .models import Donation, DonationItem, Need, Notification, Organization

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
    has_owner = serializers.SerializerMethodField()
    map_embed_url = serializers.SerializerMethodField()
    image = serializers.ImageField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "description",
            "location",
            "address",
            "contact_email",
            "contact_phone",
            "image_url",
            "image",
            "map_embed_url",
            "name_change_count",
            "needs",
            "has_owner",
        ]
        read_only_fields = ["id", "has_owner", "map_embed_url", "name_change_count"]

    def get_has_owner(self, org):
        return org.owner_id is not None

    def get_map_embed_url(self, org):
        return build_map_embed_url(org.address, org.location)

    def _sync_image_url(self, instance):
        if not instance.image:
            return instance
        url = instance.image.url
        request = self.context.get("request")
        if request:
            url = request.build_absolute_uri(url)
        if instance.image_url != url:
            instance.image_url = url
            instance.save(update_fields=["image_url"])
        return instance

    def create(self, validated_data):
        image = validated_data.pop("image", None)
        instance = super().create(validated_data)
        if image is not None:
            instance.image = image
            instance.save(update_fields=["image"])
            self._sync_image_url(instance)
        return instance

    def update(self, instance, validated_data):
        new_name = validated_data.get("name")
        if new_name is not None and new_name.strip() != instance.name:
            if instance.name_change_count >= 1:
                raise serializers.ValidationError(
                    {"name": "Organization name can only be changed once."}
                )
            validated_data["name_change_count"] = instance.name_change_count + 1
        image = validated_data.pop("image", None)
        instance = super().update(instance, validated_data)
        if image is not None:
            instance.image = image
            instance.save(update_fields=["image"])
            self._sync_image_url(instance)
        return instance


class OrganizationSummarySerializer(serializers.ModelSerializer):
    map_embed_url = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "description",
            "location",
            "address",
            "contact_email",
            "contact_phone",
            "image_url",
            "map_embed_url",
        ]

    def get_map_embed_url(self, org):
        return build_map_embed_url(org.address, org.location)


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
        fields = ["id", "description", "location", "status", "created_at", "donor"]
        read_only_fields = ["id", "status", "created_at", "donor"]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "message", "link", "read", "created_at"]
        read_only_fields = ["id", "message", "link", "read", "created_at"]


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

    def validate(self, attrs):
        password = attrs.get("password") or ""
        email = attrs.get("email") or ""
        name = (attrs.get("name") or "").strip()
        errors = []
        if password and email and password.lower() == email.lower():
            errors.append("Password cannot be the same as your email.")
        if password and name and password.lower() == name.lower():
            errors.append("Password cannot be the same as your name.")
        parts = name.split(None, 1)
        user = User(
            email=email,
            username=email,
            first_name=parts[0] if parts else "",
            last_name=parts[1] if len(parts) > 1 else "",
        )
        try:
            validate_password(password, user)
        except DjangoValidationError as exc:
            errors.extend(list(exc.messages))
        if errors:
            raise serializers.ValidationError({"password": errors})
        return attrs

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
