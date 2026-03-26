/** Reject garbage like the literal "video" string that was stored before extractor fixes. */
export function isHttpMediaUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const t = url.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  try {
    const u = new URL(t);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** HLS manifests work in Safari’s native video element; Chromium needs hls.js — do not use as plain src. */
const M3U8_PATH_RE = /\.m3u8(\?|#|$)/i;

export function isNativeVideoElementUrl(url: string | null | undefined): boolean {
  if (!isHttpMediaUrl(url)) return false;
  return !M3U8_PATH_RE.test(url!.trim());
}

export function sanitizeVideoUrl(url: string | null | undefined): string | null {
  return isHttpMediaUrl(url) ? url!.trim() : null;
}

export function sanitizeImageUrl(url: string | null | undefined): string | null {
  return isHttpMediaUrl(url) ? url!.trim() : null;
}

/** At least one field is a usable http(s) media URL (for session eligibility). */
export function hasRenderableMediaUrl(
  imageUrl: string | null | undefined,
  videoUrl: string | null | undefined
): boolean {
  return sanitizeImageUrl(imageUrl) !== null || sanitizeVideoUrl(videoUrl) !== null;
}
