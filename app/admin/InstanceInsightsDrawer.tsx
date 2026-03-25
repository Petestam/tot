'use client';

import { useEffect } from 'react';
import { InstanceInsightsContent } from './InstanceInsightsContent';
import { useInstanceInsights } from './useInstanceInsights';

export function InstanceInsightsDrawer({
  open,
  onClose,
  instanceId,
  instanceName,
  instanceSlug,
}: {
  open: boolean;
  onClose: () => void;
  instanceId: string | null;
  instanceName: string;
  instanceSlug: string;
}) {
  const { sessions, stats, loading, refresh } = useInstanceInsights(instanceId, open && !!instanceId);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open || !instanceId) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal aria-labelledby="instance-insights-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close panel"
      />
      <div className="absolute inset-y-0 right-0 z-10 flex w-full max-w-xl flex-col border-l border-white/10 bg-zinc-950 shadow-2xl md:max-w-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Sessions & stats</p>
            <h2 id="instance-insights-title" className="truncate text-lg font-semibold text-white">
              {instanceName}
            </h2>
            <p className="truncate text-xs text-zinc-500">/p/{instanceSlug}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <a
              href={`/admin/instances/${instanceId}`}
              className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10"
              onClick={onClose}
            >
              Open full page
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              Close
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <InstanceInsightsContent
            instanceId={instanceId}
            loading={loading}
            sessions={sessions}
            stats={stats}
            onRefresh={refresh}
          />
        </div>
      </div>
    </div>
  );
}
