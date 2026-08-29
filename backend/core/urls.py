from django.urls import path

from .views import (
    AnalyzeDonationView,
    CreateNeedView,
    DonationMatchesView,
    NeedDetailView,
    OrganizationDetailView,
    OrganizationListView,
    StatsView,
)

urlpatterns = [
    path("stats/", StatsView.as_view()),
    path("organizations/", OrganizationListView.as_view()),
    path("organizations/<int:pk>/", OrganizationDetailView.as_view()),
    path("organizations/<int:pk>/needs/", CreateNeedView.as_view()),
    path("needs/<int:pk>/", NeedDetailView.as_view()),
    path("donations/analyze/", AnalyzeDonationView.as_view()),
    path("donations/<int:pk>/matches/", DonationMatchesView.as_view()),
]
