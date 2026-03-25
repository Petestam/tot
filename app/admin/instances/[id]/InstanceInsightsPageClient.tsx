'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { InstanceInsightsContent } from '../../InstanceInsightsContent';
import { useInstanceInsights } from '../../useInstanceInsights';

type InstanceMeta = {
  id: string;
  slug: string;
  name: string;
  archivedAt: string | null;
};

export function InstanceInsightsPageClient() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : null;

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [instance, setInstance] = useState<InstanceMeta | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    const r = await fetch('/api/admin/me', { credentials: 'include' });
    const d = await r.json();
    setAuthed(!!d.authenticated);
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (!authed || !id) {
      if (authed === false) setInstance(null);
      return;
    }
    let cancelled = false;
    setInstance(undefined);
    void (async () => {
      setLoadError(null);
      const r = await fetch(`/api/admin/instances/${encodeURIComponent(id)}`, { credentials: 'include' });
      const d = await r.json();
      if (cancelled) return;
      if (!r.ok) {
        setInstance(null);
        setLoadError(d.error || 'Not found');
        return;
      }
      if (d.instance) setInstance(d.instance);
      else setInstance(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, id]);

  const { sessions, stats, loading, refresh } = useInstanceInsights(
    id,
    authed === true && !!id && !!instance
  );

  if (authed === null) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-zinc-950 p-6 text-center">
        <p className="text-zinc-400">Sign in to view instance insights.</p>
        <a href="/admin" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900">
          Back to admin
        </a>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="p-8 text-zinc-500">
        <a href="/admin" className="text-emerald-400 hover:underline">
          ← Admin
        </a>
        <p className="mt-4">Invalid instance.</p>
      </div>
    );
  }

  if (instance === undefined) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-500">
        Loading instance…
      </div>
    );
  }

  if (instance === null) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <a href="/admin" className="text-sm text-emerald-400 hover:underline">
          ← Admin
        </a>
        <p className="mt-6 text-zinc-400">{loadError || 'Instance not found.'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-5 py-8 md:px-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <a href="/admin" className="text-sm text-zinc-500 hover:text-white">
              ← Instances
            </a>
            <p className="mt-3 text-xs uppercase tracking-wide text-zinc-500">Sessions & stats</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{instance.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">/p/{instance.slug}</p>
            {instance.archivedAt && (
              <p className="mt-2 text-xs text-amber-200/90">Archived — play URL is disabled.</p>
            )}
          </div>
        </div>

        <InstanceInsightsContent
          instanceId={id}
          loading={loading}
          sessions={sessions}
          stats={stats}
          onRefresh={refresh}
        />
      </div>
    </div>
  );
}
