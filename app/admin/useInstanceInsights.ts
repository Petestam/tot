'use client';

import { useEffect, useState } from 'react';
import type { InstanceStats, SessionRow } from './instance-insights-types';

export function useInstanceInsights(instanceId: string | null, enabled: boolean) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [stats, setStats] = useState<InstanceStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !instanceId) {
      setSessions([]);
      setStats(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const [sRes, aRes] = await Promise.all([
          fetch(`/api/admin/sessions?instanceId=${encodeURIComponent(instanceId)}`, {
            credentials: 'include',
          }),
          fetch(`/api/admin/instances/${encodeURIComponent(instanceId)}/aggregate`, {
            credentials: 'include',
          }),
        ]);
        const sess = await sRes.json();
        const agg = await aRes.json();
        if (cancelled) return;
        setSessions(sRes.ok && Array.isArray(sess.sessions) ? sess.sessions : []);
        if (aRes.ok && agg?.pins) setStats(agg as InstanceStats);
        else setStats(null);
      } catch {
        if (!cancelled) {
          setSessions([]);
          setStats(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [instanceId, enabled]);

  return { sessions, stats, loading };
}
