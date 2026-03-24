'use client';

import type { InstanceStats, SessionRow } from './instance-insights-types';

export function InstanceInsightsContent({
  loading,
  sessions,
  stats,
}: {
  loading: boolean;
  sessions: SessionRow[];
  stats: InstanceStats | null;
}) {
  if (loading) {
    return <p className="text-sm text-zinc-500">Loading sessions and stats…</p>;
  }

  return (
    <div className="space-y-10">
      <div>
        <h3 className="mb-3 text-sm font-medium text-zinc-300">Sessions</h3>
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
