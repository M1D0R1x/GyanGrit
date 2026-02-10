"""
URL configuration for gyangrit project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),

    # Accounts (already correct)
    path("api/v1/accounts/", include("apps.accounts.api.v1.urls")),

    # 🔴 FIX: mount content at /api/v1/ (NOT /content/)
    path("api/v1/", include("apps.content.api.v1.urls")),

    # Learning stays namespaced
    path("api/v1/learning/", include("apps.learning.api.v1.urls")),

    # Assessments stays namespaced
    path("api/v1/assessments/", include("apps.assessments.api.v1.urls")),
]
