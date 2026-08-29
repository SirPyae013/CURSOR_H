from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .ai import explain_match, extract_items, template_reason
from .matching import score_organization
from .models import Donation, DonationItem, Match, Need, Organization
from .serializers import (
    DonationItemSerializer,
    DonationSerializer,
    NeedSerializer,
    OrganizationSerializer,
    OrganizationSummarySerializer,
)


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
    def post(self, request, pk):
        try:
            org = Organization.objects.get(pk=pk)
        except Organization.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        serializer = NeedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=org)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class NeedDetailView(APIView):
    def patch(self, request, pk):
        try:
            need = Need.objects.get(pk=pk)
        except Need.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        serializer = NeedSerializer(need, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        try:
            need = Need.objects.get(pk=pk)
        except Need.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
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
        donation = Donation.objects.create(description=description, location=location)

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
