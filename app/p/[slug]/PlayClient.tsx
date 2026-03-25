/* eslint-disable @next/next/no-img-element -- Pinterest CDN URLs; avoid optimizer config */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDrag } from '@use-gesture/react';

// When a Pinterest pin is a video/gif, it may have a playable URL (videoUrl) in addition to a thumbnail.
type PinDtoWithMotion = { id: string; imageUrl: string | null; videoUrl: string | null; title: string };

/** Reserve space for global site footer (fixed) */
const mainMinH = 'min-h-[calc(100dvh-3.5rem)]';

export function PlayClient({ slug }: { slug: string }) {
  const introKey = useMemo(() => `tot_play_intro_dismissed_${slug}`, [slug]);

  const [publicId, setPublicId] = useState<string | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [left, setLeft] = useState<PinDtoWithMotion | null>(null);
  const [right, setRight] = useState<PinDtoWithMotion | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [hasBegun, setHasBegun] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const leftVideoRef = useRef<HTMLVideoElement | null>(null);
  const rightVideoRef = useRef<HTMLVideoElement | null>(null);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/play/${encodeURIComponent(slug)}/session`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start');
      setPublicId(data.publicId);
      setRoundIndex(data.roundIndex);
      setLeft(data.left);
      setRight(data.right);
      setDone(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    // First time visitor: show intro modal before starting the first session.
    // Stored per-slug, so if you want to play a different game you’ll see it again.
    try {
      const dismissed = localStorage.getItem(introKey) === '1';
      if (dismissed) {
        setHasBegun(true);
        setIntroOpen(false);
      } else {
        setHasBegun(false);
        setIntroOpen(true);
      }
    } catch {
      // If localStorage is blocked, still allow play.
      setHasBegun(true);
      setIntroOpen(false);
    }
  }, [introKey]);

  useEffect(() => {
    if (!hasBegun) return;
    start();
  }, [hasBegun, start]);

  useEffect(() => {
    // Autoplay is allowed only if muted; some browsers also require an explicit play() call.
    // If play() fails, we leave the poster image visible.
    if (!leftVideoRef.current) return;
    leftVideoRef.current.play().catch(() => {});
  }, [left?.videoUrl, publicId]);

  useEffect(() => {
    if (!rightVideoRef.current) return;
    rightVideoRef.current.play().catch(() => {});
  }, [right?.videoUrl, publicId]);

  const submitPick = useCallback(
    async (pickedPinId: string) => {
      if (!publicId) return;
      setError(null);
      try {
        const res = await fetch(
          `/api/play/${encodeURIComponent(slug)}/session/${encodeURIComponent(publicId)}/choice`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pickedPinId }),
            credentials: 'include',
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Choice failed');
        if (data.done) {
          setDone(true);
          setLeft(null);
          setRight(null);
          return;
        }
        setRoundIndex(data.roundIndex);
        setLeft(data.left);
        setRight(data.right);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      }
    },
    [publicId, slug]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || !left || !right) return;
      if (e.key === '1' || e.key === 'ArrowLeft') {
        e.preventDefault();
        submitPick(left.id);
      }
      if (e.key === '2' || e.key === 'ArrowRight') {
        e.preventDefault();
        submitPick(right.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, left, right, submitPick]);

  const bind = useDrag(
    ({ movement: [mx], velocity: [vx], last, cancel }) => {
      if (!last || !left || !right) return;
      const threshold = 72;
      if (Math.abs(mx) > threshold || Math.abs(vx) > 0.4) {
        cancel?.();
        if (mx < 0) submitPick(left.id);
        else submitPick(right.id);
      }
    },
    { axis: 'x', filterTaps: true }
  );

  if (loading && !left) {
    return (
      <div className={`${mainMinH} flex items-center justify-center bg-zinc-950 text-zinc-100`}>
        <p className="text-lg">Loading…</p>
      </div>
    );
  }

  const introOrInfoOpen = introOpen && !hasBegun;

  if (introOrInfoOpen || infoOpen) {
    return (
      <div className={`${mainMinH} flex flex-col items-center justify-center bg-black text-white px-6`}>
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950/80 p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">This or That</h1>
              <p className="mt-2 text-sm text-zinc-400">
                Tap, use keys 1 / 2, or swipe ← / → to choose between two Pinterest pins.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setInfoOpen(false)}
              className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg hover:bg-white/10"
            >
              i
            </button>
          </div>

          <div className="mt-4 space-y-3 text-sm text-zinc-200">
            <p>
              Your picks are recorded to help us learn which pins tend to “win” against each other.
            </p>
            <p className="text-zinc-500">
              We log technical data (like IP and user agent) for analytics and to help keep sessions consistent.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (introOrInfoOpen) {
                try {
                  localStorage.setItem(introKey, '1');
                } catch {
                  // ignore
                }
                setIntroOpen(false);
                setHasBegun(true);
              } else {
                setInfoOpen(false);
              }
            }}
            className="mt-6 w-full rounded-xl bg-white text-zinc-900 py-3 font-medium"
          >
            {introOrInfoOpen ? 'Begin' : 'Close'}
          </button>
        </div>
      </div>
    );
  }

  if (error && !left) {
    return (
      <div className={`${mainMinH} flex flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-100 px-6`}>
        <p className="text-center text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => start()}
          className="rounded-full bg-white text-zinc-900 px-6 py-3 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className={`${mainMinH} flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-zinc-900 to-black text-white px-6`}>
        <h1 className="text-3xl font-semibold tracking-tight">You&apos;re done</h1>
        <p className="text-zinc-400 text-center max-w-md">
          Thanks — your picks are recorded. Swipe or tap another round anytime.
        </p>
        <button
          type="button"
          onClick={() => start()}
          className="rounded-full bg-white text-zinc-900 px-8 py-3 font-medium"
        >
          Play again
        </button>
      </div>
    );
  }

  if (!left || !right) return null;

  return (
    <div className={`${mainMinH} flex flex-col bg-black text-white`}>
      <header className="shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-start justify-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">This or That</span>
            <button
              type="button"
              aria-label="What is this?"
              onClick={() => {
                setInfoOpen(true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-zinc-200 hover:bg-white/10"
            >
              i
            </button>
          </div>
        </div>
        <div className="mt-1 flex justify-center">
          <span className="text-sm text-zinc-500">Round {roundIndex + 1}</span>
        </div>
      </header>

      <p className="text-center text-xs text-zinc-500 px-4 py-2">
        Tap, use keys 1 / 2, or swipe ← / → · We log technical data (e.g. IP) for analytics.
      </p>

      {error && (
        <p className="text-center text-sm text-red-400 px-4">{error}</p>
      )}

      <div
        className="flex-1 flex min-h-0 touch-pan-y"
        {...bind()}
      >
        <button
          type="button"
          className="flex-1 relative min-w-0 border-r border-white/10 active:bg-white/5 transition-colors"
          onClick={() => submitPick(left.id)}
        >
          {left.videoUrl ? (
            <video
              key={left.videoUrl}
              src={left.videoUrl}
              muted
              playsInline
              loop
              autoPlay
              preload="auto"
              poster={left.imageUrl ?? undefined}
              className="absolute inset-0 m-auto max-h-full max-w-full object-contain p-2"
              ref={(el) => {
                leftVideoRef.current = el;
              }}
            />
          ) : left.imageUrl ? (
            <img
              src={left.imageUrl}
              alt={left.title || 'Option 1'}
              className="absolute inset-0 m-auto max-h-full max-w-full object-contain p-2"
            />
          ) : null}
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm">
            1 · Left
          </span>
        </button>
        <button
          type="button"
          className="flex-1 relative min-w-0 active:bg-white/5 transition-colors"
          onClick={() => submitPick(right.id)}
        >
          {right.videoUrl ? (
            <video
              key={right.videoUrl}
              src={right.videoUrl}
              muted
              playsInline
              loop
              autoPlay
              preload="auto"
              poster={right.imageUrl ?? undefined}
              className="absolute inset-0 m-auto max-h-full max-w-full object-contain p-2"
              ref={(el) => {
                rightVideoRef.current = el;
              }}
            />
          ) : right.imageUrl ? (
            <img
              src={right.imageUrl}
              alt={right.title || 'Option 2'}
              className="absolute inset-0 m-auto max-h-full max-w-full object-contain p-2"
            />
          ) : null}
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm">
            2 · Right
          </span>
        </button>
      </div>
    </div>
  );
}
