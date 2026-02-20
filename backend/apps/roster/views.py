from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.permissions import require_roles
from apps.roster.services import process_roster_upload, regenerate_student_code


# =========================================================
# UPLOAD ROSTER
# =========================================================

@require_roles(["TEACHER"])
@require_http_methods(["POST"])
def upload_roster(request):

    file = request.FILES.get("file")

    if not file:
        return JsonResponse({"error": "No file provided"}, status=400)

    try:
        created = process_roster_upload(file, request.user)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({
        "created_count": len(created),
        "students": created,
    })


# =========================================================
# REGENERATE CODE
# =========================================================

@require_roles(["TEACHER", "PRINCIPAL"])
@require_http_methods(["POST"])
def regenerate_code(request):

    record_id = request.POST.get("record_id")

    if not record_id:
        return JsonResponse({"error": "record_id required"}, status=400)

    try:
        result = regenerate_student_code(record_id, request.user)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse(result)

from .services import list_registration_records


@require_roles(["TEACHER", "PRINCIPAL"])
@require_http_methods(["GET"])
def list_records(request):

    section_id = request.GET.get("section_id")

    try:
        records = list_registration_records(
            request.user,
            section_id=section_id,
        )
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({
        "count": len(records),
        "records": records,
    })