/**
 * Pinterest v5 pin media is a discriminated union (image | video | multiple_images | …).
 * @see https://github.com/pinterest/api-description — PinMedia, ImageSize
 */

const IMAGE_SIZE_KEYS = [
  '1200x',
  '600x',
  'original',
  'originals',
  '736x',
  '564x',
  '474x',
  '400x300',
  '150x150',
] as const;

type PinterestImageInfo = { url?: string; width?: number; height?: number };
const GIF_URL_HINT_RE = /\.gif(\?|#|$)/i;

function pickFromImageSizeMap(images: Record<string, unknown>): string | null {
  for (const k of IMAGE_SIZE_KEYS) {
    const slot = images[k] as PinterestImageInfo | undefined;
    if (slot?.url) return slot.url;
  }
  for (const v of Object.values(images)) {
    const slot = v as PinterestImageInfo | undefined;
    if (slot?.url) return slot.url;
  }
  return null;
}

function pickGifFromImageSizeMap(images: Record<string, unknown>): string | null {
  for (const k of IMAGE_SIZE_KEYS) {
    const slot = images[k] as PinterestImageInfo | undefined;
    if (slot?.url && GIF_URL_HINT_RE.test(slot.url)) return slot.url;
  }
  for (const v of Object.values(images)) {
    const slot = v as PinterestImageInfo | undefined;
    if (slot?.url && GIF_URL_HINT_RE.test(slot.url)) return slot.url;
  }
  return null;
}

/** Walk nested media for a `url` field (carousel / mixed types). */
function deepFindUrl(obj: unknown, depth = 0): string | null {
  if (depth > 12 || obj === null || obj === undefined) return null;
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const u = (obj as { url?: unknown }).url;
    if (typeof u === 'string' && u.startsWith('http')) return u;
  }
  if (Array.isArray(obj)) {
    for (const el of obj) {
      const u = deepFindUrl(el, depth + 1);
      if (u) return u;
    }
    return null;
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      const u = deepFindUrl(v, depth + 1);
      if (u) return u;
    }
  }
  return null;
}

const VIDEO_URL_HINT_RE = /\.(mp4|webm|ogg)(\?|#|$)/i;

function looksLikeVideoUrl(url: string): boolean {
  return VIDEO_URL_HINT_RE.test(url) || /\/video\//i.test(url) || /video/i.test(url);
}

/** Best-effort extraction of a playable video URL from Pinterest media objects. */
function deepFindFirstVideoUrl(obj: unknown, depth = 0): string | null {
  if (depth > 12 || obj === null || obj === undefined) return null;

  if (typeof obj === 'string') {
    return looksLikeVideoUrl(obj) ? obj : null;
  }

  if (Array.isArray(obj)) {
    for (const el of obj) {
      const u = deepFindFirstVideoUrl(el, depth + 1);
      if (u) return u;
    }
    return null;
  }

  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'string' && looksLikeVideoUrl(v) && k.toLowerCase().includes('video')) {
        return v;
      }
      const u = deepFindFirstVideoUrl(v, depth + 1);
      if (u) return u;
    }
  }

  return null;
}

function deepFindFirstGifUrl(obj: unknown, depth = 0): string | null {
  if (depth > 12 || obj === null || obj === undefined) return null;

  if (typeof obj === 'string') {
    return GIF_URL_HINT_RE.test(obj) ? obj : null;
  }

  if (Array.isArray(obj)) {
    for (const el of obj) {
      const u = deepFindFirstGifUrl(el, depth + 1);
      if (u) return u;
    }
    return null;
  }

  if (typeof obj === 'object') {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      const u = deepFindFirstGifUrl(v, depth + 1);
      if (u) return u;
    }
  }

  return null;
}

export type PinItem = {
  id: string;
  title: string;
  imageUrl: string | null;
  videoUrl: string | null;
  width?: number;
  height?: number;
};

type PinterestPin = {
  id: string;
  title?: string;
  media?: Record<string, unknown>;
};

export function mapPinterestPin(pin: PinterestPin): PinItem {
  const title = pin.title ?? '';
  const media = pin.media;
  if (!media || typeof media !== 'object') {
    return { id: pin.id, title, imageUrl: null, videoUrl: null };
  }

  const mediaType = media.media_type as string | undefined;

  // Video: cover_image_url and/or images map
  if (mediaType === 'video') {
    const cover =
      typeof media.cover_image_url === 'string' ? media.cover_image_url : null;
    const fromImages =
      media.images && typeof media.images === 'object'
        ? pickFromImageSizeMap(media.images as Record<string, unknown>)
        : null;
    const url = cover ?? fromImages;
    const videoUrl = deepFindFirstVideoUrl(media);
    return { id: pin.id, title, imageUrl: url, videoUrl };
  }

  // Standard single image
  if (mediaType === 'image' && media.images && typeof media.images === 'object') {
    const images = media.images as Record<string, unknown>;
    const animatedGifUrl = pickGifFromImageSizeMap(images) ?? deepFindFirstGifUrl(media);
    const videoUrl = deepFindFirstVideoUrl(media);
    const url = animatedGifUrl ?? pickFromImageSizeMap(images);
    return { id: pin.id, title, imageUrl: url, videoUrl };
  }

  // Carousel / multiple images — first slide has nested images
  if (mediaType === 'multiple_images' && Array.isArray(media.items) && media.items.length > 0) {
    const first = media.items[0] as { images?: Record<string, unknown> };
    if (first?.images && typeof first.images === 'object') {
      const url = pickGifFromImageSizeMap(first.images) ?? pickFromImageSizeMap(first.images);
      if (url) return { id: pin.id, title, imageUrl: url, videoUrl: null };
    }
    const url = deepFindUrl(media.items[0]);
    return { id: pin.id, title, imageUrl: url, videoUrl: null };
  }

  // Mixed carousel
  if (mediaType === 'multiple_mixed' && Array.isArray(media.items)) {
    const url = deepFindUrl(media.items);
    return { id: pin.id, title, imageUrl: url, videoUrl: null };
  }

  // Legacy / unknown: try cover_image_url (some responses)
  if (typeof media.cover_image_url === 'string') {
    return { id: pin.id, title, imageUrl: media.cover_image_url, videoUrl: null };
  }

  // Generic images map without media_type
  if (media.images && typeof media.images === 'object') {
    const url = pickFromImageSizeMap(media.images as Record<string, unknown>);
    if (url) return { id: pin.id, title, imageUrl: url, videoUrl: null };
  }

  const fallback = deepFindUrl(media);
  return { id: pin.id, title, imageUrl: fallback, videoUrl: null };
}

export async function fetchAllBoardPins(
  accessToken: string,
  boardId: string
): Promise<PinItem[]> {
  const all: PinItem[] = [];
  let bookmark: string | null = null;
  do {
    const url = new URL(`https://api.pinterest.com/v5/boards/${boardId}/pins`);
    url.searchParams.set('page_size', '100');
    if (bookmark) url.searchParams.set('bookmark', bookmark);

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || `Pinterest pins error: ${r.status}`);
    }
    const data = (await r.json()) as { items?: PinterestPin[]; bookmark?: string | null };
    const rawItems: PinterestPin[] = data.items ?? [];
    for (const p of rawItems) {
      const item = mapPinterestPin(p);
      if (item.imageUrl || item.videoUrl) all.push(item);
    }
    bookmark = data.bookmark ?? null;
  } while (bookmark);

  return all;
}

export async function fetchAllBoards(
  accessToken: string
): Promise<Array<{ id: string; name: string }>> {
  const boards: Array<{ id: string; name: string }> = [];
  let bookmark: string | undefined;
  const pageSize = 100;
  do {
    const url = new URL('https://api.pinterest.com/v5/boards');
    url.searchParams.set('page_size', String(pageSize));
    if (bookmark) url.searchParams.set('bookmark', bookmark);

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || `Pinterest boards error: ${r.status}`);
    }
    const data = (await r.json()) as {
      items?: Array<{ id: string; name: string }>;
      bookmark?: string;
    };
    boards.push(...(data.items ?? []));
    bookmark = data.bookmark || undefined;
  } while (bookmark);

  return boards;
}
