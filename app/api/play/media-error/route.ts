import { NextRequest, NextResponse } from 'next/server';

type MediaErrorBody = {
  slug?: string;
  publicId?: string | null;
  roundIndex?: number;
  side?: 'left' | 'right';
  pinId?: string | null;
  mediaType?: 'video' | 'gif' | 'image' | 'video_poster' | 'none';
  imageUrl?: string | null;
  videoUrl?: string | null;
  renderedUrl?: string | null;
  reason?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as MediaErrorBody;
  console.warn('[tot-media-error]', {
    slug: body.slug ?? null,
    publicId: body.publicId ?? null,
    roundIndex: body.roundIndex ?? null,
    side: body.side ?? null,
    pinId: body.pinId ?? null,
    mediaType: body.mediaType ?? null,
    imageUrl: body.imageUrl ?? null,
    videoUrl: body.videoUrl ?? null,
    renderedUrl: body.renderedUrl ?? null,
    reason: body.reason ?? 'unknown',
  });

  return NextResponse.json({ ok: true });
}

