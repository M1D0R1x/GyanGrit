"""
Cloudflare R2 service — S3-compatible object storage.

All file uploads go through this module. Never call boto3 directly
from views — always use these functions so R2 config is in one place.
"""
import logging
import mimetypes
import os
import uuid

import boto3
from botocore.config import Config
from django.conf import settings

logger = logging.getLogger(__name__)

# Allowed upload types and their max sizes
ALLOWED_TYPES = {
    "image/jpeg":       10 * 1024 * 1024,   # 10 MB
    "image/png":        10 * 1024 * 1024,
    "image/webp":       10 * 1024 * 1024,
    "application/pdf":  50 * 1024 * 1024,   # 50 MB
    "video/mp4":       500 * 1024 * 1024,   # 500 MB
    "video/webm":      500 * 1024 * 1024,
}


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


def upload_file(file_obj, folder: str = "uploads") -> dict:
    """
    Upload a file to Cloudflare R2 and return its public URL.

    Args:
        file_obj: Django UploadedFile object
        folder:   Subfolder within the bucket (e.g. "lessons", "pdfs")

    Returns:
        {
            "url": "https://pub-xxx.r2.dev/lessons/uuid.pdf",
            "key": "lessons/uuid.pdf",
            "content_type": "application/pdf",
            "size": 102400,
        }

    Raises:
        ValueError: if file type or size is not allowed
        Exception:  if R2 upload fails
    """
    content_type = file_obj.content_type or _guess_content_type(file_obj.name)

    if content_type not in ALLOWED_TYPES:
        raise ValueError(
            f"File type '{content_type}' is not allowed. "
            f"Allowed: {', '.join(ALLOWED_TYPES.keys())}"
        )

    max_size = ALLOWED_TYPES[content_type]
    if file_obj.size > max_size:
        raise ValueError(
            f"File size {file_obj.size} exceeds maximum "
            f"{max_size // (1024 * 1024)} MB for this file type."
        )

    ext = os.path.splitext(file_obj.name)[1].lower()
    key = f"{folder}/{uuid.uuid4().hex}{ext}"

    client = _get_client()
    client.upload_fileobj(
        file_obj,
        settings.CLOUDFLARE_R2_BUCKET_NAME,
        key,
        ExtraArgs={
            "ContentType": content_type,
            "CacheControl": "public, max-age=31536000",
        },
    )

    public_url = f"{settings.CLOUDFLARE_R2_PUBLIC_URL.rstrip('/')}/{key}"

    logger.info("Uploaded %s to R2: %s (%d bytes)", file_obj.name, key, file_obj.size)

    return {
        "url": public_url,
        "key": key,
        "content_type": content_type,
        "size": file_obj.size,
    }


def delete_file(key: str) -> None:
    """Delete a file from R2 by its key."""
    client = _get_client()
    client.delete_object(Bucket=settings.CLOUDFLARE_R2_BUCKET_NAME, Key=key)
    logger.info("Deleted R2 object: %s", key)


def _guess_content_type(filename: str) -> str:
    mime, _ = mimetypes.guess_type(filename)
    return mime or "application/octet-stream"