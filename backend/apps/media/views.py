import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.permissions import require_roles
from .r2 import upload_file

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
        file   — the file to upload
        folder — optional subfolder (default: "uploads")
                 allowed: lessons, pdfs, images, uploads, videos

    Returns:
        { url, key, content_type, size }

    Security:
    - File type validated in r2.py (ALLOWED_TYPES whitelist)
    - File size validated in r2.py per type
    - Folder sanitised to known values only
    - Role check via @require_roles decorator
    """
    uploaded = request.FILES.get("file")

    if not uploaded:
        return JsonResponse({"error": "No file provided"}, status=400)

    folder = request.POST.get("folder", "uploads").strip("/")

    allowed_folders = {"lessons", "pdfs", "images", "uploads", "videos"}
    if folder not in allowed_folders:
        folder = "uploads"

    try:
        result = upload_file(uploaded, folder=folder)
        logger.info(
            "File uploaded to R2: key=%s size=%s by user=%s role=%s",
            result["key"],
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