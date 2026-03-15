from django.shortcuts import render

# Create your views here.
import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accesscontrol.permissions import require_roles
from .r2 import upload_file

logger = logging.getLogger(__name__)


@csrf_exempt
@require_roles(["ADMIN", "TEACHER"])
@require_http_methods(["POST"])
def upload(request):
    """
    Upload a file to Cloudflare R2.

    Accepts multipart/form-data with:
        file   — the file to upload
        folder — optional subfolder (default: "uploads")

    Returns:
        { url, key, content_type, size }
    """
    uploaded = request.FILES.get("file")

    if not uploaded:
        return JsonResponse({"error": "No file provided"}, status=400)

    folder = request.POST.get("folder", "uploads").strip("/")

    # Sanitise folder — only allow known folders
    allowed_folders = {"lessons", "pdfs", "images", "uploads"}
    if folder not in allowed_folders:
        folder = "uploads"

    try:
        result = upload_file(uploaded, folder=folder)
        return JsonResponse(result)
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception:
        logger.exception("R2 upload failed for file %s", uploaded.name)
        return JsonResponse({"error": "Upload failed. Please try again."}, status=500)