import json

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger

from apps.accesscontrol.permissions import require_roles
from .services import (
    process_roster_upload,
    regenerate_student_code,
    list_registration_records,
)


# =========================================================
# UPLOAD ROSTER (CSV/Excel file upload)
# =========================================================

@require_roles(["TEACHER"])
@require_http_methods(["POST"])
def upload_roster(request):
    """
    Upload a roster file (CSV/Excel) to create StudentRegistrationRecord entries.
    Only TEACHERS can upload.
    """
    if 'file' not in request.FILES:
        return JsonResponse({"success": False, "error": "No file provided"}, status=400)

    file = request.FILES['file']

    try:
        created_records = process_roster_upload(file, request.user)
        return JsonResponse({
            "success": True,
            "created_count": len(created_records),
            "students": created_records,
        })
    except ValueError as ve:
        return JsonResponse({"success": False, "error": str(ve)}, status=400)
    except Exception as e:
        return JsonResponse({"success": False, "error": "Server error during upload"}, status=500)


# =========================================================
# REGENERATE REGISTRATION CODE
# =========================================================

@require_roles(["TEACHER", "PRINCIPAL"])
@require_http_methods(["POST"])
def regenerate_code(request):
    """
    Regenerate the registration code for a specific StudentRegistrationRecord.
    Only TEACHER/PRINCIPAL can do this.
    """
    body = json.loads(request.body)
    record_id = body.get("record_id")

    if not record_id:
        return JsonResponse({"success": False, "error": "record_id is required"}, status=400)

    try:
        result = regenerate_student_code(record_id, request.user)
        return JsonResponse({
            "success": True,
            **result  # includes new_code, record_id, etc.
        })
    except ValueError as ve:
        return JsonResponse({"success": False, "error": str(ve)}, status=400)
    except PermissionError as pe:
        return JsonResponse({"success": False, "error": str(pe)}, status=403)
    except Exception as e:
        return JsonResponse({"success": False, "error": "Server error"}, status=500)


# =========================================================
# LIST REGISTRATION RECORDS
# =========================================================

@require_roles(["TEACHER", "PRINCIPAL"])
@require_http_methods(["GET"])
def list_records(request):
    """
    List StudentRegistrationRecord entries.
    Optional query param: ?section_id=123&page=1&limit=20
    """
    section_id = request.GET.get("section_id")
    page = request.GET.get("page", 1)
    limit = int(request.GET.get("limit", 20))  # default 20 per page

    try:
        records = list_registration_records(
            request.user,
            section_id=section_id,
        )
    except ValueError as ve:
        return JsonResponse({"success": False, "error": str(ve)}, status=400)
    except Exception as e:
        return JsonResponse({"success": False, "error": "Server error"}, status=500)

    # Paginate results
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
        "records": page_obj.object_list,
    })