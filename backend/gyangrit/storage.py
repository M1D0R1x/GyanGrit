"""
gyangrit/storage.py — Custom static file storage for production.

Problem solved:
    whitenoise.storage.CompressedManifestStaticFilesStorage (strict mode) raises:
        ValueError: Missing staticfiles manifest entry for 'unfold/fonts/inter/styles.css'

    This happens when django-unfold bumps its static assets between deploys and
    collectstatic hasn't run yet, or when a package ships new static files that
    weren't hashed in the current manifest.

Solution:
    Subclass WhiteNoise's CompressedManifestStaticFilesStorage and set
    manifest_strict = False, which makes Django fall back to the original
    (unhashed) file path instead of raising ValueError.

    The unhashed file still exists and is served correctly — it just won't have
    a cache-busting hash suffix until the next `collectstatic` run.

Sentry issue: BRONZE-GARDEN-P (admin login 500, 18 events over 8 days)
"""
from whitenoise.storage import CompressedManifestStaticFilesStorage


class RelaxedManifestStaticFilesStorage(CompressedManifestStaticFilesStorage):
    """
    WhiteNoise compressed+hashed storage that doesn't crash when a static
    file is missing from the manifest.

    manifest_strict = False: fall back to the original filename instead of
    raising ValueError when the hash entry is absent.
    """
    manifest_strict = False
