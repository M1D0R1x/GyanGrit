import json
import logging

from django.core.exceptions import ValidationError
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.permissions import require_roles
from .services import (
    list_registration_records,
    process_roster_upload,
    regenerate_student_code,
)

logger = logging.getLogger(__name__)


# =========================================================
# UPLOAD ROSTER
# =========================================================

# Decorator order matters — outermost executes first:
# csrf_exempt → strips CSRF check
# require_roles → checks auth + role
# require_http_methods → checks HTTP method

@csrf_exempt
@require_roles(["TEACHER", "ADMIN"])
@require_http_methods(["POST"])
def upload_roster(request):
    uploaded_file = request.FILES.get("file")

    if not uploaded_file:
        return JsonResponse(
            {"success": False, "error": "No file provided"},
            status=400,
        )

    if uploaded_file.size > 5 * 1024 * 1024:
        return JsonResponse(
            {"success": False, "error": "File too large. Max 5MB allowed."},
            status=400,
        )

    if not uploaded_file.name.lower().endswith((".xlsx", ".xls")):
        return JsonResponse(
            {"success": False, "error": "Only .xlsx or .xls files allowed."},
            status=400,
        )

    try:
        result = process_roster_upload(uploaded_file, request.user)
        return JsonResponse({
            "success": True,
            "created_count": len(result["created"]),
            "skipped_count": len(result["skipped"]),
            "students": result["created"],
            "skipped": result["skipped"],
        })

    except ValidationError as e:
        return JsonResponse(
            {"success": False, "error": str(e)},
            status=400,
        )

    except Exception:
        logger.exception(
            "Unexpected error during roster upload by user id=%s.",
            request.user.id,
        )
        return JsonResponse(
            {"success": False, "error": "Server error during upload."},
            status=500,
        )


# =========================================================
# REGENERATE REGISTRATION CODE
# =========================================================

@csrf_exempt
@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["POST"])
def regenerate_code(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse(
            {"success": False, "error": "Invalid JSON body"},
            status=400,
        )

    record_id = body.get("record_id")

    if not record_id:
        return JsonResponse(
            {"success": False, "error": "record_id is required"},
            status=400,
        )

    try:
        result = regenerate_student_code(record_id, request.user)
        return JsonResponse({"success": True, **result})

    except ValidationError as e:
        return JsonResponse(
            {"success": False, "error": str(e)},
            status=400,
        )

    except Exception:
        logger.exception(
            "Unexpected error during code regeneration by user id=%s.",
            request.user.id,
        )
        return JsonResponse(
            {"success": False, "error": "Server error."},
            status=500,
        )


# =========================================================
# LIST REGISTRATION RECORDS
# =========================================================

@require_roles(["TEACHER", "PRINCIPAL", "ADMIN"])
@require_http_methods(["GET"])
def list_records(request):
    section_id = request.GET.get("section_id")
    page = request.GET.get("page", 1)

    try:
        limit = int(request.GET.get("limit", 20))
        if limit <= 0 or limit > 200:
            raise ValueError
    except ValueError:
        return JsonResponse(
            {"success": False, "error": "limit must be a positive integer up to 200"},
            status=400,
        )

    try:
        records = list_registration_records(request.user, section_id=section_id)

    except ValidationError as e:
        return JsonResponse(
            {"success": False, "error": str(e)},
            status=400,
        )

    except Exception:
        logger.exception(
            "Unexpected error listing records for user id=%s.",
            request.user.id,
        )
        return JsonResponse(
            {"success": False, "error": "Server error."},
            status=500,
        )

    paginator = Paginator(records, limit)

    try:
        page_obj = paginator.page(page)
    except PageNotAnInteger:
        page_obj = paginator.page(1)
    except EmptyPage:
        page_obj = paginator.page(paginator.num_pages)

    return JsonResponse({
        "success": True,
        "count": paginator.count,
        "total_pages": paginator.num_pages,
        "current_page": page_obj.number,
        "records": list(page_obj.object_list),
    })