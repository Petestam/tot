'use client';

import { useState } from 'react';
import type { InstanceStats, SessionRow } from './instance-insights-types';

export function InstanceInsightsContent({
  instanceId,
  loading,
  sessions,
  stats,
  onRefresh,
}: {
  instanceId: string | null;
  loading: boolean;
  sessions: SessionRow[];
  stats: InstanceStats | null;
  onRefresh: () => void;
}) {
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [cleanupNote, setCleanupNote] = useState<string | null>(null);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading sessions and stats…</p>;
  }

  const clearSessionsBefore = async (minutesAgo: number) => {
    if (!instanceId) return;
    setCleanupError(null);
    setCleanupNote(null);
    const createdBefore = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
    const ok = window.confirm(
      `Delete sessions for this instance created before:\n${createdBefore}\n\nThis can affect active players who started recently.`
    );
    if (!ok) return;

    setCleanupBusy(true);
    try {
      const r = await fetch(
        `/api/admin/sessions?instanceId=${encodeURIComponent(instanceId)}&mode=before&createdBefore=${encodeURIComponent(
          createdBefore
        )}`,
        { method: 'DELETE', credentials: 'include' }
      );
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as { error?: string }).error || 'Cleanup failed');
      setCleanupNote(`Deleted ${typeof d.deletedCount === 'number' ? d.deletedCount : 'sessions'} successfully.`);
      onRefresh();
    } catch (e) {
      setCleanupError(e instanceof Error ? e.message : 'Cleanup failed');
    } finally {
      setCleanupBusy(false);
    }
  };

  const clearAllSessions = async () => {
    if (!instanceId) return;
    setCleanupError(null);
    setCleanupNote(null);
    const ok = window.confirm(
      'Delete ALL sessions for this instance? This cannot be undone and will break any active sessions.'
    );
    if (!ok) return;

    setCleanupBusy(true);
    try {
      const r = await fetch(
        `/api/admin/sessions?instanceId=${encodeURIComponent(instanceId)}&mode=all`,
        { method: 'DELETE', credentials: 'include' }
      );
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as { error?: string }).error || 'Cleanup failed');
      setCleanupNote(`Deleted ${typeof d.deletedCount === 'number' ? d.deletedCount : 'sessions'} successfully.`);
      onRefresh();
    } catch (e) {
      setCleanupError(e instanceof Error ? e.message : 'Cleanup failed');
    } finally {
      setCleanupBusy(false);
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-zinc-300">Sessions</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void clearSessionsBefore(15)}
              disabled={cleanupBusy}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10 disabled:opacity-50"
            >
              Clear older than 15m
            </button>
            <button
              type="button"
              onClick={() => void clearAllSessions()}
              disabled={cleanupBusy}
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-50"
            >
              Clear all
            </button>
          </div>
        </div>
        {cleanupError && <p className="mb-3 text-sm text-red-400">{cleanupError}</p>}
        {cleanupNote && <p className="mb-3 text-sm text-emerald-400/90">{cleanupNote}</p>}
        {sessions.length === 0 ? (
          <p className="text-sm text-zinc-500">No play sessions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-zinc-500">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Choices</th>
                  <th className="py-2 pr-4">IP</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-white/5">
                    <td className="whitespace-nowrap py-2 pr-4">{new Date(s.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-4">{s.choiceCount}</td>
                    <td className="py-2 pr-4 text-zinc-500">{s.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-sm font-medium text-zinc-300">Stats</h3>
        {stats && (
          <p className="mb-4 text-xs text-zinc-500">Total choices recorded: {stats.totalChoices}</p>
        )}
        {!stats ? (
          <p className="text-sm text-zinc-500">Stats could not be loaded.</p>
        ) : stats.pins.length === 0 ? (
          <p className="text-sm text-zinc-500">No choice data yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {stats.pins.map((p) => (
              <div
                key={p.pinId}
                className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
              >
                <div className="relative aspect-square bg-zinc-900/80">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-600">
                      No image
                    </div>
                  )}
                </div>
                <div className="flex min-h-0 flex-col gap-2 p-3">
                  <p className="line-clamp-3 text-xs leading-snug text-zinc-300">{p.title}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <span className="text-emerald-400/90">Wins {p.positive}</span>
                    <span className="text-rose-400/90">Rejects {p.negative}</span>
                  </div>
                  {p.winRate !== null && (
                    <p className="text-[11px] text-zinc-500">
                      Win rate {(p.winRate * 100).toFixed(1)}% · {p.appearances} appearances
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
