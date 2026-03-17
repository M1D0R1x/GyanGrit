# apps.media.r2
"""
Cloudflare R2 service — S3-compatible object storage.

All file uploads go through this module. Never call boto3 directly
from views — always use these functions so R2 config is in one place.

Key naming convention:
  {folder}/{sanitized-display-name}-{6-char-hex}.{ext}

  Example: notification-files/holiday-notice-a3f2c1.pdf

  The 6-char hex collision guard is mandatory — without it, two teachers
  uploading "holiday notice.pdf" on the same day would overwrite each other.
  The guard is invisible to end users who see attachment_name, not the R2 key.
"""
import logging
import mimetypes
import os
import re
import unicodedata
import uuid

import boto3
from botocore.config import Config
from django.conf import settings

logger = logging.getLogger(__name__)

# ── Folder constants — always use these, never hardcode strings ──────────────
FOLDER_LESSONS        = "lessons"
FOLDER_PDFS           = "pdfs"
FOLDER_IMAGES         = "images"
FOLDER_UPLOADS        = "uploads"
FOLDER_VIDEOS         = "videos"
FOLDER_NOTIFICATIONS  = "notification-files"   # attachments sent with notifications

ALLOWED_FOLDERS = {
    FOLDER_LESSONS,
    FOLDER_PDFS,
    FOLDER_IMAGES,
    FOLDER_UPLOADS,
    FOLDER_VIDEOS,
    FOLDER_NOTIFICATIONS,
}

# ── Allowed MIME types and their per-type max sizes ───────────────────────────
ALLOWED_TYPES: dict[str, int] = {
    # Images
    "image/jpeg":  10 * 1024 * 1024,   # 10 MB
    "image/png":   10 * 1024 * 1024,
    "image/webp":  10 * 1024 * 1024,
    # Documents
    "application/pdf": 50 * 1024 * 1024,   # 50 MB
    # Microsoft Office (notification attachments)
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": 10 * 1024 * 1024,  # docx
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":       10 * 1024 * 1024,  # xlsx
    # Legacy Office (some devices still generate these)
    "application/msword":   10 * 1024 * 1024,  # .doc
    "application/vnd.ms-excel": 10 * 1024 * 1024,  # .xls
    # Video
    "video/mp4":  500 * 1024 * 1024,   # 500 MB
    "video/webm": 500 * 1024 * 1024,
}

# Notification attachments are capped at 10 MB regardless of type
NOTIFICATION_MAX_SIZE = 10 * 1024 * 1024


def sanitize_filename(name: str, max_length: int = 80) -> str:
    """
    Convert a human-readable filename into a safe R2 key segment.

    Rules:
    - Normalise unicode to ASCII (café → cafe)
    - Lowercase
    - Replace spaces and underscores with hyphens
    - Strip all characters except [a-z0-9-.]
    - Collapse multiple consecutive hyphens
    - Strip leading/trailing hyphens
    - Truncate to max_length (excluding extension)
    - Never return an empty string — fall back to "file"

    Example:
        "Holiday Notice (Final).pdf" → "holiday-notice-final.pdf"
        "தமிழ் document.docx"       → "file.docx"   (non-ASCII → stripped)
    """
    # Strip the extension first — we handle it separately
    root, ext = os.path.splitext(name)
    ext = ext.lower()

    # Normalise unicode: decompose then encode to ASCII, ignoring non-ASCII
    try:
        normalised = (
            unicodedata.normalize("NFKD", root)
            .encode("ascii", "ignore")
            .decode("ascii")
        )
    except (UnicodeDecodeError, UnicodeEncodeError):
        normalised = ""

    # Lowercase and replace whitespace/underscores with hyphens
    safe = normalised.lower().replace(" ", "-").replace("_", "-")

    # Strip everything except alphanumerics and hyphens
    safe = re.sub(r"[^a-z0-9-]", "", safe)

    # Collapse multiple hyphens, strip leading/trailing
    safe = re.sub(r"-{2,}", "-", safe).strip("-")

    # Truncate root to max_length
    if len(safe) > max_length:
        safe = safe[:max_length].rstrip("-")

    # Fall back to "file" if nothing usable remains
    if not safe:
        safe = "file"

    return f"{safe}{ext}"


def _build_key(folder: str, display_name: str) -> str:
    """
    Build the R2 object key from folder and display name.

    Format: {folder}/{sanitized-name}-{6-char-hex}{ext}

    The 6-char hex suffix prevents collisions without date paths.
    It is opaque in the R2 console but the end user never sees it
    — they see attachment_name ("holiday notice.pdf"), not the key.
    """
    safe = sanitize_filename(display_name)
    root, ext = os.path.splitext(safe)
    suffix = uuid.uuid4().hex[:6]
    return f"{folder}/{root}-{suffix}{ext}"


def _get_client():
    """Return a boto3 S3 client pointed at Cloudflare R2."""
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.CLOUDFLARE_R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def upload_file(
    file_obj,
    folder: str = FOLDER_UPLOADS,
    display_name: str = "",
) -> dict:
    """
    Upload a file to Cloudflare R2 and return its public URL.

    Args:
        file_obj:     Django UploadedFile object
        folder:       Subfolder constant from this module (e.g. FOLDER_NOTIFICATIONS)
        display_name: Human-readable name to base the key on.
                      Defaults to file_obj.name if not provided.

    Returns:
        {
            "url":          "https://pub-xxx.r2.dev/notification-files/holiday-notice-a3f2c1.pdf",
            "key":          "notification-files/holiday-notice-a3f2c1.pdf",
            "display_name": "holiday notice.pdf",   ← original name, stored in DB
            "content_type": "application/pdf",
            "size":         102400,
        }

    Raises:
        ValueError: if file type or size is not allowed, or folder is not in ALLOWED_FOLDERS
        Exception:  if R2 upload fails
    """
    # Validate folder
    if folder not in ALLOWED_FOLDERS:
        raise ValueError(
            f"Folder '{folder}' is not allowed. Allowed: {', '.join(sorted(ALLOWED_FOLDERS))}"
        )

    # Resolve content type
    content_type = file_obj.content_type or _guess_content_type(file_obj.name)

    # Validate MIME type
    if content_type not in ALLOWED_TYPES:
        raise ValueError(
            f"File type '{content_type}' is not allowed. "
            f"Allowed: {', '.join(sorted(ALLOWED_TYPES.keys()))}"
        )

    # Apply notification-specific size cap
    if folder == FOLDER_NOTIFICATIONS:
        max_size = NOTIFICATION_MAX_SIZE
    else:
        max_size = ALLOWED_TYPES[content_type]

    if file_obj.size > max_size:
        raise ValueError(
            f"File size {file_obj.size / (1024*1024):.1f} MB exceeds the "
            f"{max_size // (1024 * 1024)} MB limit for this folder/type."
        )

    # Build key from display name (or original filename as fallback)
    name_to_use = display_name.strip() or file_obj.name
    key = _build_key(folder, name_to_use)

    client = _get_client()
    client.upload_fileobj(
        file_obj,
        settings.CLOUDFLARE_R2_BUCKET_NAME,
        key,
        ExtraArgs={
            "ContentType": content_type,
            "CacheControl": "public, max-age=31536000",
            # Force download — browser should never try to render arbitrary uploads
            "ContentDisposition": (
                f'attachment; filename="{sanitize_filename(name_to_use)}"'
            ),
        },
    )

    public_url = f"{settings.CLOUDFLARE_R2_PUBLIC_URL.rstrip('/')}/{key}"

    logger.info(
        "Uploaded to R2: key=%s display_name=%s size=%d bytes",
        key, name_to_use, file_obj.size,
    )

    return {
        "url":          public_url,
        "key":          key,
        "display_name": name_to_use,
        "content_type": content_type,
        "size":         file_obj.size,
    }


def delete_file(key: str) -> None:
    """Delete a file from R2 by its key."""
    client = _get_client()
    client.delete_object(Bucket=settings.CLOUDFLARE_R2_BUCKET_NAME, Key=key)
    logger.info("Deleted R2 object: %s", key)


def _guess_content_type(filename: str) -> str:
    mime, _ = mimetypes.guess_type(filename)
    return mime or "application/octet-stream"