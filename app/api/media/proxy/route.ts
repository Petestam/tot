import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOST_SUFFIXES = [
  '.pinimg.com',
  '.pinterestusercontent.com',
  '.pinterest.com',
];

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((suffix) => h === suffix.slice(1) || h.endsWith(suffix));
}

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get('u');
  if (!src) {
    return NextResponse.json({ error: 'Missing media URL parameter' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(src);
  } catch {
    return NextResponse.json({ error: 'Invalid media URL' }, { status: 400 });
  }

  if (parsed.protocol !== 'https:' || !isAllowedHost(parsed.hostname)) {
    return NextResponse.json({ error: 'Media URL host is not allowed' }, { status: 400 });
  }

  const upstream = await fetch(parsed.toString(), {
    headers: {
      // Some CDNs vary responses by UA, keep it explicit and stable.
      'User-Agent': 'tot-media-proxy/1.0',
    },
    cache: 'force-cache',
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Upstream media fetch failed (${upstream.status})` },
      { status: 502 }
    );
  }

  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  const contentLength = upstream.headers.get('content-length');
  const etag = upstream.headers.get('etag');
  const lastModified = upstream.headers.get('last-modified');

  if (contentType) headers.set('content-type', contentType);
  if (contentLength) headers.set('content-length', contentLength);
  if (etag) headers.set('etag', etag);
  if (lastModified) headers.set('last-modified', lastModified);
  headers.set('cache-control', 'public, s-maxage=86400, stale-while-revalidate=604800');

  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  });
}

