/* eslint-disable @next/next/no-img-element -- Pinterest CDN URLs; avoid optimizer config */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDrag } from '@use-gesture/react';

type PinDto = { id: string; imageUrl: string | null; title: string };

export function PlayClient({ slug }: { slug: string }) {
  const [publicId, setPublicId] = useState<string | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [left, setLeft] = useState<PinDto | null>(null);
  const [right, setRight] = useState<PinDto | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    start();
  }, [start]);

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
      <div className="min-h-[100dvh] flex items-center justify-center bg-zinc-950 text-zinc-100">
        <p className="text-lg">Loading…</p>
      </div>
    );
  }

  if (error && !left) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-100 px-6">
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
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-zinc-900 to-black text-white px-6">
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
    <div className="min-h-[100dvh] flex flex-col bg-black text-white">
      <header className="shrink-0 px-4 py-3 flex justify-between items-center border-b border-white/10">
        <span className="text-sm text-zinc-400">This or That</span>
        <span className="text-sm text-zinc-500">Round {roundIndex + 1}</span>
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
          {left.imageUrl && (
            <img
              src={left.imageUrl}
              alt={left.title || 'Option 1'}
              className="absolute inset-0 m-auto max-h-full max-w-full object-contain p-2"
            />
          )}
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm">
            1 · Left
          </span>
        </button>
        <button
          type="button"
          className="flex-1 relative min-w-0 active:bg-white/5 transition-colors"
          onClick={() => submitPick(right.id)}
        >
          {right.imageUrl && (
            <img
              src={right.imageUrl}
              alt={right.title || 'Option 2'}
              className="absolute inset-0 m-auto max-h-full max-w-full object-contain p-2"
            />
          )}
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm">
            2 · Right
          </span>
        </button>
      </div>
    </div>
  );
}
