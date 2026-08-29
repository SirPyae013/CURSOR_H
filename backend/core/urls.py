from django.urls import path

from .views import (
    AnalyzeDonationView,
    BecomeReceiverView,
    CreateNeedView,
    DonationMatchesView,
    LoginView,
    MeView,
    MyDonationsView,
    MyOrganizationView,
    NeedDetailView,
    OrganizationDetailView,
    OrganizationListView,
    RefreshView,
    RegisterView,
    StatsView,
)

urlpatterns = [
    path("stats/", StatsView.as_view()),
    path("auth/register/", RegisterView.as_view()),
    path("auth/login/", LoginView.as_view()),
    path("auth/refresh/", RefreshView.as_view()),
    path("auth/me/", MeView.as_view()),
    path("auth/become-receiver/", BecomeReceiverView.as_view()),
    path("organizations/", OrganizationListView.as_view()),
    path("organizations/me/", MyOrganizationView.as_view()),
    path("organizations/<int:pk>/", OrganizationDetailView.as_view()),
    path("organizations/<int:pk>/needs/", CreateNeedView.as_view()),
    path("needs/<int:pk>/", NeedDetailView.as_view()),
    path("donations/analyze/", AnalyzeDonationView.as_view()),
    path("donations/mine/", MyDonationsView.as_view()),
    path("donations/<int:pk>/matches/", DonationMatchesView.as_view()),
]
