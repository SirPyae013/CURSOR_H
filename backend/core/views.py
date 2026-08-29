from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .ai import explain_match, extract_items, template_reason
from .matching import score_organization
from .models import Donation, DonationItem, Match, Need, Organization
from .serializers import (
    DonationItemSerializer,
    DonationSerializer,
    NeedSerializer,
    OrganizationSerializer,
    OrganizationSummarySerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    RoleTokenObtainPairSerializer,
    UserSerializer,
)

User = get_user_model()


def serialize_match(match):
    breakdown = match.breakdown or {}
    org = match.organization
    return {
        "id": match.id,
        "score": match.score,
        "reason": match.reason,
        "breakdown": {
            "item": breakdown.get("item", 0),
            "urgency": breakdown.get("urgency", 0),
            "location": breakdown.get("location", 0),
            "quantity": breakdown.get("quantity", 0),
        },
        "item_matches": breakdown.get("item_matches", []),
        "impact": breakdown.get("impact", []),
        "highest_urgency": breakdown.get("highest_urgency", "medium"),
        "organization": OrganizationSummarySerializer(org).data,
    }


def tokens_for_user(user):
    refresh = RoleTokenObtainPairSerializer.get_token(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSerializer(user).data,
    }


def owned_organization(user):
    return user.owned_organization


def require_org_owner(user, org):
    if not user.is_authenticated:
        return Response({"detail": "Authentication required."}, status=401)
    if org.owner_id != user.id:
        return Response({"detail": "You do not manage this organization."}, status=403)
    return None


class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(tokens_for_user(user), status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    serializer_class = RoleTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.user
        return Response(
            {
                "access": serializer.validated_data["access"],
                "refresh": serializer.validated_data["refresh"],
                "user": UserSerializer(user).data,
            }
        )


class RefreshView(TokenRefreshView):
    pass


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class BecomeReceiverView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not user.is_receiver:
            user.is_receiver = True
            user.save(update_fields=["is_receiver"])
        return Response(tokens_for_user(user))


class MyOrganizationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_receiver:
            return Response({"detail": "Receiver role required."}, status=403)
        org = owned_organization(request.user)
        if not org:
            return Response({"detail": "No organization yet."}, status=404)
        org = Organization.objects.prefetch_related("needs").get(pk=org.pk)
        return Response(OrganizationSerializer(org).data)

    def post(self, request):
        if not request.user.is_receiver:
            return Response({"detail": "Receiver role required."}, status=403)
        if owned_organization(request.user):
            return Response({"detail": "You already have an organization."}, status=400)
        serializer = OrganizationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(owner=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def patch(self, request):
        if not request.user.is_receiver:
            return Response({"detail": "Receiver role required."}, status=403)
        org = owned_organization(request.user)
        if not org:
            return Response({"detail": "No organization yet."}, status=404)
        serializer = OrganizationSerializer(org, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        org = Organization.objects.prefetch_related("needs").get(pk=org.pk)
        return Response(OrganizationSerializer(org).data)


class MyDonationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        donations = (
            Donation.objects.filter(donor=request.user)
            .prefetch_related("items", "matches__organization")
            .order_by("-created_at")
        )
        payload = []
        for donation in donations:
            matches = [serialize_match(m) for m in donation.matches.all()]
            matches.sort(key=lambda item: item["score"], reverse=True)
            payload.append(
                {
                    **DonationSerializer(donation).data,
                    "items": DonationItemSerializer(donation.items.all(), many=True).data,
                    "top_match": matches[0] if matches else None,
                }
            )
        return Response(payload)


class StatsView(APIView):
    def get(self, request):
        return Response(
            {
                "donations": Donation.objects.count(),
                "organizations": Organization.objects.count(),
                "needs": Need.objects.count(),
            }
        )


class OrganizationListView(APIView):
    def get(self, request):
        orgs = Organization.objects.prefetch_related("needs").all()
        return Response(OrganizationSerializer(orgs, many=True).data)


class OrganizationDetailView(APIView):
    def get(self, request, pk):
        try:
            org = Organization.objects.prefetch_related("needs").get(pk=pk)
        except Organization.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        return Response(OrganizationSerializer(org).data)


class CreateNeedView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            org = Organization.objects.get(pk=pk)
        except Organization.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        denied = require_org_owner(request.user, org)
        if denied:
            return denied
        serializer = NeedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=org)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class NeedDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            need = Need.objects.select_related("organization").get(pk=pk)
        except Need.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        denied = require_org_owner(request.user, need.organization)
        if denied:
            return denied
        serializer = NeedSerializer(need, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        try:
            need = Need.objects.select_related("organization").get(pk=pk)
        except Need.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        denied = require_org_owner(request.user, need.organization)
        if denied:
            return denied
        need.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AnalyzeDonationView(APIView):
    def post(self, request):
        description = (request.data.get("description") or "").strip()
        location = (request.data.get("location") or "").strip()
        if not description or not location:
            return Response(
                {"detail": "description and location are required"},
                status=400,
            )

        items = extract_items(description)
        donor = request.user if request.user.is_authenticated else None
        donation = Donation.objects.create(
            description=description,
            location=location,
            donor=donor,
        )

        for item in items:
            DonationItem.objects.create(donation=donation, **item)

        matches_payload = []
        orgs = Organization.objects.prefetch_related("needs").all()
        for org in orgs:
            scored = score_organization(items, org, location)
            facts = {
                "organization": org.name,
                "location": org.location,
                "donation_location": location,
                "score": scored["score"],
                "breakdown": scored["breakdown"],
                "item_matches": scored["item_matches"],
                "donation_items": items,
                "needs": [
                    {
                        "item_name": n.item_name,
                        "category": n.category,
                        "urgency": n.urgency,
                        "remaining": n.remaining,
                    }
                    for n in org.needs.all()
                ],
            }
            reason = explain_match(facts) or template_reason(org, scored, location)
            stored = {
                **scored["breakdown"],
                "item_matches": scored["item_matches"],
                "impact": scored["impact"],
                "highest_urgency": scored["highest_urgency"],
            }
            match = Match.objects.create(
                donation=donation,
                organization=org,
                score=scored["score"],
                reason=reason,
                breakdown=stored,
            )
            matches_payload.append(serialize_match(match))

        matches_payload.sort(key=lambda m: m["score"], reverse=True)
        top3 = matches_payload[:3]
        return Response(
            {
                "donation": DonationSerializer(donation).data,
                "items": DonationItemSerializer(donation.items.all(), many=True).data,
                "matches": top3,
            }
        )


class DonationMatchesView(APIView):
    def get(self, request, pk):
        try:
            donation = Donation.objects.prefetch_related("items", "matches__organization").get(
                pk=pk
            )
        except Donation.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        matches = [serialize_match(m) for m in donation.matches.all()]
        matches.sort(key=lambda m: m["score"], reverse=True)
        return Response(
            {
                "donation": DonationSerializer(donation).data,
                "items": DonationItemSerializer(donation.items.all(), many=True).data,
                "matches": matches[:3],
            }
        )
