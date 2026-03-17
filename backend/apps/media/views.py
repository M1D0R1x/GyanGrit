# apps.media.views
import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.permissions import require_roles
from .r2 import upload_file, ALLOWED_FOLDERS, FOLDER_UPLOADS

logger = logging.getLogger(__name__)


@csrf_exempt
@require_roles(["ADMIN", "TEACHER", "PRINCIPAL"])
@require_http_methods(["POST"])
def upload(request):
    """
    POST /api/v1/media/upload/

    Upload a file to Cloudflare R2.
    Allowed roles: ADMIN, TEACHER, PRINCIPAL

    Accepts multipart/form-data with:
        file         — the file to upload (required)
        folder       — subfolder key (default: "uploads")
                       see r2.ALLOWED_FOLDERS for valid values
        display_name — human-readable name to use as the R2 key base
                       (optional; defaults to the uploaded filename)

    Returns:
        { url, key, display_name, content_type, size }

    Security:
    - MIME type validated against whitelist in r2.ALLOWED_TYPES
    - File size validated per type and per folder in r2.upload_file()
    - Folder sanitised to known values only
    - display_name length capped at 200 chars, path separators stripped
    - Role check via @require_roles decorator
    """
    uploaded = request.FILES.get("file")
    if not uploaded:
        return JsonResponse({"error": "No file provided"}, status=400)

    # Validate folder
    folder = request.POST.get("folder", FOLDER_UPLOADS).strip("/").strip()
    if folder not in ALLOWED_FOLDERS:
        folder = FOLDER_UPLOADS

    # Sanitise display_name: strip path separators and null bytes, cap length
    raw_display_name = request.POST.get("display_name", "").strip()
    # Remove path separators and null bytes
    import os
    display_name = os.path.basename(raw_display_name.replace("\x00", ""))[:200]

    try:
        result = upload_file(uploaded, folder=folder, display_name=display_name)
        logger.info(
            "File uploaded to R2: key=%s display_name=%s size=%s by user=%s role=%s",
            result["key"],
            result["display_name"],
            result["size"],
            request.user.id,
            request.user.role,
        )
        return JsonResponse(result)
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception:
        logger.exception(
            "R2 upload failed for file '%s' by user=%s",
            uploaded.name,
            request.user.id,
        )
        return JsonResponse({"error": "Upload failed. Please try again."}, status=500)