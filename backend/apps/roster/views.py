import json

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.views.decorators.csrf import csrf_exempt
from django.core.exceptions import ValidationError

from apps.accesscontrol.permissions import require_roles
from .services import (
    process_roster_upload,
    regenerate_student_code,
    list_registration_records,
)


# =========================================================
# UPLOAD ROSTER
# =========================================================

@require_roles(["TEACHER"])
@require_http_methods(["POST"])
@csrf_exempt
def upload_roster(request):
    uploaded_file = request.FILES.get("file")

    if not uploaded_file:
        return JsonResponse(
            {"success": False, "error": "No file provided"},
            status=400,
        )

    try:
        created_records = process_roster_upload(
            uploaded_file,
            request.user,
        )

        return JsonResponse({
            "success": True,
            "created_count": len(created_records),
            "students": created_records,
        })

    except ValidationError as e:
        return JsonResponse(
            {"success": False, "error": str(e)},
            status=400,
        )

    except Exception:
        return JsonResponse(
            {"success": False, "error": "Server error during upload"},
            status=500,
        )


# =========================================================
# REGENERATE REGISTRATION CODE
# =========================================================

@require_roles(["TEACHER", "PRINCIPAL"])
@require_http_methods(["POST"])
@csrf_exempt
def regenerate_code(request):
    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse(
            {"success": False, "error": "Invalid JSON"},
            status=400,
        )

    record_id = body.get("record_id")

    if not record_id:
        return JsonResponse(
            {"success": False, "error": "record_id is required"},
            status=400,
        )

    try:
        result = regenerate_student_code(
            record_id,
            request.user,
        )

        return JsonResponse({
            "success": True,
            **result,
        })

    except ValidationError as e:
        return JsonResponse(
            {"success": False, "error": str(e)},
            status=400,
        )

    except Exception:
        return JsonResponse(
            {"success": False, "error": "Server error"},
            status=500,
        )


# =========================================================
# LIST REGISTRATION RECORDS
# =========================================================

@require_roles(["TEACHER", "PRINCIPAL"])
@require_http_methods(["GET"])
def list_records(request):
    section_id = request.GET.get("section_id")
    page = request.GET.get("page", 1)

    try:
        limit = int(request.GET.get("limit", 20))
        if limit <= 0:
            raise ValueError
    except ValueError:
        return JsonResponse(
            {"success": False, "error": "Invalid limit value"},
            status=400,
        )

    try:
        records = list_registration_records(
            request.user,
            section_id=section_id,
        )

    except ValidationError as e:
        return JsonResponse(
            {"success": False, "error": str(e)},
            status=400,
        )

    except Exception:
        return JsonResponse(
            {"success": False, "error": "Server error"},
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