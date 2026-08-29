from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .ai import _normalize_item, explain_match, extract_items, template_reason
from .emailcheck import check_email_address
from .matching import score_organization
from .models import Donation, DonationItem, Match, Need, Notification, Organization
from .serializers import (
    DonationItemSerializer,
    DonationSerializer,
    NeedSerializer,
    NotificationSerializer,
    OrganizationSerializer,
    OrganizationSummarySerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    RoleTokenObtainPairSerializer,
    UserSerializer,
)

User = get_user_model()

GUEST_MATCH_WINDOW = timedelta(hours=2)
INBOX_STATUSES = ("pledged", "accepted", "declined", "delivered")
LOCKED_STATUSES = ("accepted", "delivered")


def serialize_match(match, include_donation=False):
    breakdown = match.breakdown or {}
    org = match.organization
    payload = {
        "id": match.id,
        "status": match.status,
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
    if include_donation:
        donation = match.donation
        donor = donation.donor
        payload["donation"] = {
            **DonationSerializer(donation).data,
            "items": DonationItemSerializer(donation.items.all(), many=True).data,
            "donor_name": donor.display_name if donor else "Guest",
        }
    return payload


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


def notify(user, message, link=""):
    if not user:
        return None
    return Notification.objects.create(user=user, message=message, link=link)


def can_view_donation_matches(request, donation):
    user = request.user
    guest_window = (
        donation.donor_id is None
        and donation.created_at >= timezone.now() - GUEST_MATCH_WINDOW
    )
    if user.is_authenticated:
        if donation.donor_id == user.id:
            return True
        org = owned_organization(user)
        if org and donation.matches.filter(organization_id=org.id).exists():
            return True
        return guest_window
    return guest_window


def preferred_org_id(data):
    raw = data.get("organization_id") or data.get("org_id") or data.get("org")
    try:
        return int(raw) if raw not in (None, "") else None
    except (TypeError, ValueError):
        return None


def select_matches(matches_payload, preferred_id=None, limit=3):
    matches_payload = sorted(matches_payload, key=lambda item: item["score"], reverse=True)
    selected = matches_payload[:limit]
    if preferred_id:
        preferred = next(
            (item for item in matches_payload if item["organization"]["id"] == preferred_id),
            None,
        )
        if preferred and all(item["id"] != preferred["id"] for item in selected):
            selected = selected[: limit - 1] + [preferred]
            selected.sort(key=lambda item: item["score"], reverse=True)
    return selected


def normalize_items(raw_items):
    if not isinstance(raw_items, list) or not raw_items:
        return None
    return [_normalize_item(item) for item in raw_items if isinstance(item, dict)]


def create_matches_for_donation(donation, items, location):
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
    return matches_payload


def apply_accepted_quantities(match):
    breakdown = dict(match.breakdown or {})
    if breakdown.get("quantities_applied"):
        return
    donation_items = {item.item_name.lower(): item for item in match.donation.items.all()}
    applied = []
    for row in breakdown.get("item_matches") or []:
        if row.get("status") == "none":
            continue
        need = None
        need_id = row.get("need_id")
        if need_id:
            need = Need.objects.filter(pk=need_id, organization=match.organization).first()
        if not need and row.get("need_name"):
            need = Need.objects.filter(
                organization=match.organization, item_name=row["need_name"]
            ).first()
        if not need:
            continue
        item = donation_items.get((row.get("item_name") or "").lower())
        quantity = item.quantity if item else 0
        if quantity <= 0:
            continue
        need.quantity_received += quantity
        need.save(update_fields=["quantity_received"])
        applied.append({"need_id": need.id, "quantity": quantity})
    breakdown["quantities_applied"] = True
    breakdown["applied_quantities"] = applied
    match.breakdown = breakdown
    match.save(update_fields=["breakdown"])


class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(tokens_for_user(user), status=status.HTTP_201_CREATED)


class CheckEmailView(APIView):
    def get(self, request):
        return Response(check_email_address(request.query_params.get("email", "")))


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
        serializer = OrganizationSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save(owner=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def patch(self, request):
        if not request.user.is_receiver:
            return Response({"detail": "Receiver role required."}, status=403)
        org = owned_organization(request.user)
        if not org:
            return Response({"detail": "No organization yet."}, status=404)
        serializer = OrganizationSerializer(
            org, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        org = Organization.objects.prefetch_related("needs").get(pk=org.pk)
        return Response(OrganizationSerializer(org, context={"request": request}).data)


class MyOrganizationMatchesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_receiver:
            return Response({"detail": "Receiver role required."}, status=403)
        org = owned_organization(request.user)
        if not org:
            return Response({"detail": "No organization yet."}, status=404)
        matches = (
            Match.objects.filter(organization=org, status__in=INBOX_STATUSES)
            .select_related("donation", "donation__donor", "organization")
            .prefetch_related("donation__items")
            .order_by("-created_at")
        )
        return Response([serialize_match(match, include_donation=True) for match in matches])


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
            chosen = next(
                (item for item in matches if item["status"] in ("pledged", "accepted", "delivered")),
                None,
            )
            payload.append(
                {
                    **DonationSerializer(donation).data,
                    "items": DonationItemSerializer(donation.items.all(), many=True).data,
                    "top_match": matches[0] if matches else None,
                    "chosen_match": chosen,
                }
            )
        return Response(payload)


class StatsView(APIView):
    def get(self, request):
        payload = {
            "donations": Donation.objects.count(),
            "organizations": Organization.objects.count(),
            "needs": Need.objects.count(),
        }
        # #region agent log
        try:
            import json
            import time
            from pathlib import Path

            Path(r"C:\Users\MSI Bravo\OneDrive\Documents\Django\CURSOR_H\debug-ade5c2.log").open("a", encoding="utf-8").write(
                json.dumps(
                    {
                        "sessionId": "ade5c2",
                        "runId": "post-fix",
                        "hypothesisId": "A",
                        "location": "views.py:StatsView.get",
                        "message": "stats ok",
                        "data": payload,
                        "timestamp": int(time.time() * 1000),
                    }
                )
                + "\n"
            )
        except Exception:
            pass
        # #endregion
        return Response(payload)


class OrganizationListView(APIView):
    def get(self, request):
        orgs = Organization.objects.prefetch_related("needs").all()
        query = (request.query_params.get("q") or "").strip()
        location = (request.query_params.get("location") or "").strip()
        category = (request.query_params.get("category") or "").strip()
        if query:
            orgs = orgs.filter(Q(name__icontains=query) | Q(description__icontains=query))
        if location:
            orgs = orgs.filter(location__icontains=location)
        if category:
            orgs = orgs.filter(needs__category=category).distinct()
        return Response(OrganizationSerializer(orgs, many=True).data)


class OrganizationDetailView(APIView):
    def get(self, request, pk):
        try:
            org = Organization.objects.prefetch_related("needs").get(pk=pk)
        except Organization.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        return Response(OrganizationSerializer(org).data)


class ClaimOrganizationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not request.user.is_receiver:
            return Response({"detail": "Receiver role required."}, status=403)
        if owned_organization(request.user):
            return Response({"detail": "You already have an organization."}, status=400)
        try:
            org = Organization.objects.prefetch_related("needs").get(pk=pk)
        except Organization.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        if org.owner_id:
            return Response({"detail": "This organization already has an owner."}, status=400)
        org.owner = request.user
        org.save(update_fields=["owner"])
        org = Organization.objects.prefetch_related("needs").get(pk=org.pk)
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


class ExtractDonationView(APIView):
    def post(self, request):
        description = (request.data.get("description") or "").strip()
        if not description:
            return Response({"detail": "description is required"}, status=400)
        items = extract_items(description)
        return Response({"items": items})


class AnalyzeDonationView(APIView):
    def post(self, request):
        description = (request.data.get("description") or "").strip()
        location = (request.data.get("location") or "").strip()
        if not description or not location:
            return Response(
                {"detail": "description and location are required"},
                status=400,
            )

        raw_items = request.data.get("items")
        if raw_items is not None:
            items = normalize_items(raw_items)
            if not items:
                return Response({"detail": "items must be a non-empty list"}, status=400)
        else:
            items = extract_items(description)

        donor = request.user if request.user.is_authenticated else None
        donation = Donation.objects.create(
            description=description,
            location=location,
            donor=donor,
        )

        for item in items:
            DonationItem.objects.create(donation=donation, **item)

        matches_payload = create_matches_for_donation(donation, items, location)
        preferred = preferred_org_id(request.data)
        return Response(
            {
                "donation": DonationSerializer(donation).data,
                "items": DonationItemSerializer(donation.items.all(), many=True).data,
                "matches": select_matches(matches_payload, preferred),
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
        if not can_view_donation_matches(request, donation):
            return Response({"detail": "Sign in to view these matches."}, status=403)
        matches = [serialize_match(m) for m in donation.matches.all()]
        preferred = preferred_org_id(request.query_params)
        return Response(
            {
                "donation": DonationSerializer(donation).data,
                "items": DonationItemSerializer(donation.items.all(), many=True).data,
                "matches": select_matches(matches, preferred),
            }
        )


class PledgeMatchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            match = Match.objects.select_related("donation", "organization", "organization__owner").get(
                pk=pk
            )
        except Match.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        donation = match.donation
        if donation.donor_id is None:
            donation.donor = request.user
            donation.save(update_fields=["donor"])
        elif donation.donor_id != request.user.id:
            return Response({"detail": "Only the donor can pledge this match."}, status=403)
        if match.status in LOCKED_STATUSES:
            return Response({"detail": "This match is already committed."}, status=400)
        locked = donation.matches.filter(status__in=LOCKED_STATUSES).exclude(pk=match.pk)
        if locked.exists():
            return Response(
                {"detail": "Another match is already accepted. You cannot switch."},
                status=400,
            )
        donation.matches.filter(status="pledged").exclude(pk=match.pk).update(status="suggested")
        match.status = "pledged"
        match.save(update_fields=["status"])
        donation.status = "pledged"
        donation.save(update_fields=["status"])
        notify(
            match.organization.owner,
            f"New pledge for {match.organization.name}: {donation.description[:80]}",
            "/dashboard",
        )
        return Response(serialize_match(match, include_donation=True))


class AcceptMatchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            match = Match.objects.select_related(
                "donation", "donation__donor", "organization"
            ).prefetch_related("donation__items").get(pk=pk)
        except Match.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        denied = require_org_owner(request.user, match.organization)
        if denied:
            return denied
        with transaction.atomic():
            match = (
                Match.objects.select_for_update()
                .select_related("donation", "donation__donor", "organization")
                .prefetch_related("donation__items")
                .get(pk=pk)
            )
            if match.status == "accepted":
                return Response(serialize_match(match, include_donation=True))
            if match.status == "delivered":
                return Response(serialize_match(match, include_donation=True))
            if match.status != "pledged":
                return Response({"detail": "Only pledged matches can be accepted."}, status=400)
            match.status = "accepted"
            match.save(update_fields=["status"])
            apply_accepted_quantities(match)
            match.donation.status = "accepted"
            match.donation.save(update_fields=["status"])
        notify(
            match.donation.donor,
            f"{match.organization.name} accepted your donation.",
            f"/results/{match.donation_id}",
        )
        match.refresh_from_db()
        return Response(serialize_match(match, include_donation=True))


class DeclineMatchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            match = Match.objects.select_related(
                "donation", "donation__donor", "organization"
            ).get(pk=pk)
        except Match.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        denied = require_org_owner(request.user, match.organization)
        if denied:
            return denied
        if match.status in LOCKED_STATUSES:
            return Response({"detail": "An accepted match cannot be declined."}, status=400)
        if match.status != "pledged":
            return Response({"detail": "Only pledged matches can be declined."}, status=400)
        match.status = "declined"
        match.save(update_fields=["status"])
        match.donation.status = "declined"
        match.donation.save(update_fields=["status"])
        notify(
            match.donation.donor,
            f"{match.organization.name} declined your donation. You can pledge another match.",
            f"/results/{match.donation_id}",
        )
        return Response(serialize_match(match, include_donation=True))


class DeliverMatchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            match = Match.objects.select_related("donation", "organization").get(pk=pk)
        except Match.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        denied = require_org_owner(request.user, match.organization)
        if denied:
            return denied
        if match.status == "delivered":
            return Response(serialize_match(match, include_donation=True))
        if match.status != "accepted":
            return Response({"detail": "Only accepted matches can be marked delivered."}, status=400)
        match.status = "delivered"
        match.save(update_fields=["status"])
        match.donation.status = "delivered"
        match.donation.save(update_fields=["status"])
        notify(
            match.donation.donor,
            f"{match.organization.name} marked your donation as delivered.",
            f"/results/{match.donation_id}",
        )
        return Response(serialize_match(match, include_donation=True))


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notes = Notification.objects.filter(user=request.user)[:50]
        return Response(
            {
                "unread_count": Notification.objects.filter(user=request.user, read=False).count(),
                "results": NotificationSerializer(notes, many=True).data,
            }
        )


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            note = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        if not note.read:
            note.read = True
            note.save(update_fields=["read"])
        return Response(NotificationSerializer(note).data)


class NotificationReadAllView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, read=False).update(read=True)
        notes = Notification.objects.filter(user=request.user)[:50]
        return Response(
            {
                "unread_count": 0,
                "results": NotificationSerializer(notes, many=True).data,
            }
        )
