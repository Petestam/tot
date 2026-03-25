'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CredentialResponse } from '@react-oauth/google';
import { ConnectModal } from './ConnectModal';
import { InstanceInsightsDrawer } from './InstanceInsightsDrawer';

type InstanceRow = {
  id: string;
  slug: string;
  name: string;
  pinterestBoardId: string;
  lastSyncedAt: string | null;
  archivedAt: string | null;
  pinCount: number;
  sessionCount: number;
};

type AdminClientProps = {
  initialAuthed: boolean;
};

export function AdminClient({ initialAuthed }: AdminClientProps) {
  const [authed, setAuthed] = useState<boolean | null>(initialAuthed);
  const [password, setPassword] = useState('');
  const [instances, setInstances] = useState<InstanceRow[]>([]);
  const [boards, setBoards] = useState<{ id: string; name: string }[]>([]);
  const [pinterestOk, setPinterestOk] = useState(false);
  const [pinterestProfile, setPinterestProfile] = useState<{
    username: string | null;
    accountId: string | null;
    profileImage: string | null;
    accountType: string | null;
    businessName: string | null;
  } | null>(null);
  const [pinterestStatusNote, setPinterestStatusNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  const [newName, setNewName] = useState('');
  const [newBoardId, setNewBoardId] = useState('');
  const [newSlug, setNewSlug] = useState('');

  /** When true, list archived instances; when false, active only */
  const [instanceArchiveView, setInstanceArchiveView] = useState(false);
  const [drawerInstanceId, setDrawerInstanceId] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    const r = await fetch('/api/admin/me', { credentials: 'include' });
    const d = await r.json();
    setAuthed(!!d.authenticated);
  }, []);

  const loadInstances = useCallback(async () => {
    const r = await fetch('/api/admin/instances', { credentials: 'include' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setInstances(d.instances);
  }, []);

  const loadBoards = useCallback(async () => {
    const r = await fetch('/api/admin/pinterest/boards', { credentials: 'include' });
    const d = await r.json();
    if (r.ok) {
      setBoards(d.boards || []);
      setPinterestOk(true);
    } else {
      setBoards([]);
      setPinterestOk(false);
    }
  }, []);

  const loadPinterestStatus = useCallback(async () => {
    const r = await fetch('/api/admin/pinterest/status', { credentials: 'include' });
    const d = await r.json();
    if (!r.ok) {
      setPinterestProfile(null);
      setPinterestStatusNote(null);
      return;
    }
    if (!d.connected) {
      setPinterestProfile(null);
      setPinterestStatusNote(null);
      setPinterestOk(false);
      return;
    }
    setPinterestOk(true);
    if (d.username != null || d.accountId != null) {
      setPinterestProfile({
        username: d.username ?? null,
        accountId: d.accountId ?? null,
        profileImage: d.profileImage ?? null,
        accountType: d.accountType ?? null,
        businessName: d.businessName ?? null,
      });
      setPinterestStatusNote(null);
    } else {
      setPinterestProfile(null);
      setPinterestStatusNote(
        typeof d.message === 'string' ? d.message : 'Pinterest token stored; profile could not be loaded.'
      );
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (authed) {
      void Promise.all([
        loadInstances(),
        loadBoards(),
        loadPinterestStatus(),
      ]).catch(() => {});
    }
  }, [authed, loadInstances, loadBoards, loadPinterestStatus]);

  useEffect(() => {
    if (typeof window === 'undefined' || !authed) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('pinterest') === 'connected') {
      loadPinterestStatus().catch(() => {});
      loadBoards().catch(() => {});
      window.history.replaceState({}, '', '/admin');
    }
    if (params.get('pinterest') === 'error') {
      const msg = params.get('msg') || 'Pinterest connection failed';
      setError(msg);
      window.history.replaceState({}, '', '/admin');
    }
  }, [authed, loadBoards, loadPinterestStatus]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      credentials: 'include',
    });
    if (!r.ok) {
      const d = await r.json();
      setError(d.error || 'Login failed');
      return;
    }
    setPassword('');
    await refreshMe();
  };

  const handleGoogleSuccess = async (cred: CredentialResponse) => {
    if (!cred.credential) return;
    setError(null);
    const r = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: cred.credential }),
      credentials: 'include',
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || 'Google sign-in failed');
      return;
    }
    await refreshMe();
  };

  const googleConfigured = typeof process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID === 'string'
    && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID.length > 0;

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    setAuthed(false);
  };

  const connectPinterest = () => {
    const clientId = process.env.NEXT_PUBLIC_PINTEREST_APP_ID;
    const redirectUri = `${window.location.origin}/api/auth/pinterest/callback`;
    if (!clientId) {
      setError('NEXT_PUBLIC_PINTEREST_APP_ID not set');
      return;
    }
    const scopes = ['boards:read', 'pins:read', 'user_accounts:read'];
    const url = `https://www.pinterest.com/oauth/?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes.join(',')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const disconnectPinterest = async () => {
    setError(null);
    const r = await fetch('/api/admin/pinterest/disconnect', {
      method: 'POST',
      credentials: 'include',
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || 'Disconnect failed');
      return;
    }
    setPinterestProfile(null);
    setPinterestStatusNote(null);
    setPinterestOk(false);
    setBoards([]);
  };

  const refreshPinterestConnection = () => {
    void loadPinterestStatus();
    void loadBoards();
  };

  const createInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const r = await fetch('/api/admin/instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: newName,
        pinterestBoardId: newBoardId,
        slug: newSlug || undefined,
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || 'Create failed');
      return;
    }
    setNewName('');
    setNewBoardId('');
    setNewSlug('');
    await loadInstances();
  };

  const syncOne = async (id: string) => {
    setError(null);
    setNotice(null);
    const r = await fetch(`/api/admin/instances/${encodeURIComponent(id)}/sync`, {
      method: 'POST',
      credentials: 'include',
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || 'Sync failed');
      return;
    }
    await loadInstances();
    const n = typeof d.count === 'number' ? d.count : 0;
    if (n < 2) {
      setNotice(
        `warning:${n}|Synced ${n} image pin(s). The board needs at least 2 pins with images — add pins on Pinterest, then Sync again.`
      );
    } else {
      setNotice(`ok:${n}|Synced ${n} pins — ready to play.`);
    }
  };

  const setInstanceArchived = async (id: string, archived: boolean) => {
    setError(null);
    const r = await fetch(`/api/admin/instances/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ archived }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || 'Update failed');
      return;
    }
    if (drawerInstanceId === id && archived) setDrawerInstanceId(null);
    await loadInstances();
  };

  const drawerInstance = drawerInstanceId ? instances.find((x) => x.id === drawerInstanceId) : undefined;

  if (authed === null) {
    return <div className="p-8 text-zinc-600">Loading…</div>;
  }

  if (!authed) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center p-6">
        <p className="mb-6 text-sm text-zinc-500">This or That — Admin</p>
        <ConnectModal
          open
          canDismiss={false}
          authed={false}
          onClose={() => {}}
          onGoogleSuccess={handleGoogleSuccess}
          onPinterest={connectPinterest}
          googleConfigured={googleConfigured}
          errorMessage={error}
          loginForm={
            <form onSubmit={login} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-zinc-500"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-white text-zinc-900 py-3 font-medium"
              >
                Sign in with password
              </button>
            </form>
          }
        />
      </div>
    );
  }

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/p/${slug}`;
    void navigator.clipboard.writeText(url);
  };

  const archivedInstanceCount = instances.filter((x) => x.archivedAt).length;

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">This or That — Admin</h1>
            <p className="text-sm text-zinc-500">
              Open sessions & stats in the side panel or full page from each instance
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setConnectModalOpen(true);
              }}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
            >
              Connect
            </button>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-zinc-400 hover:text-white"
            >
              Log out
            </button>
          </div>
        </header>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        {notice && (
          <p
            className={`text-sm ${
              notice.startsWith('warning:') ? 'text-amber-200' : 'text-emerald-400/90'
            }`}
          >
            {notice.replace(/^(warning|ok):\d+\|/, '')}
          </p>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h2 className="text-lg font-medium">Pinterest</h2>
            <button
              type="button"
              onClick={refreshPinterestConnection}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Refresh status
            </button>
          </div>

          {!pinterestOk && (
            <p className="text-sm text-zinc-500">
              Use <strong className="text-zinc-300">Connect</strong> (top right) to authorize Pinterest
              (boards + profile).
            </p>
          )}

          {pinterestOk && pinterestProfile && (
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
              {pinterestProfile.profileImage ? (
                // Pinterest CDN URLs; avoid next/image remote config churn
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pinterestProfile.profileImage}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-full border border-white/10 object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-dashed border-white/20 bg-white/5 text-xl text-zinc-500">
                  @
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">
                  {pinterestProfile.username
                    ? `@${pinterestProfile.username}`
                    : pinterestProfile.accountId
                      ? `Account ${pinterestProfile.accountId}`
                      : 'Connected'}
                </p>
                {pinterestProfile.businessName && (
                  <p className="text-sm text-zinc-400">{pinterestProfile.businessName}</p>
                )}
                <p className="text-xs text-zinc-500">
                  {pinterestProfile.accountType === 'BUSINESS'
                    ? 'Business account'
                    : pinterestProfile.accountType === 'PINNER'
                      ? 'Personal account'
                      : pinterestProfile.accountType || 'Pinterest'}
                </p>
              </div>
              <button
                type="button"
                onClick={disconnectPinterest}
                className="shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/20"
              >
                Disconnect
              </button>
            </div>
          )}

          {pinterestOk && !pinterestProfile && pinterestStatusNote && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-100/90">
              <p>{pinterestStatusNote}</p>
              <button
                type="button"
                onClick={disconnectPinterest}
                className="mt-3 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10"
              >
                Disconnect Pinterest
              </button>
            </div>
          )}

          {pinterestOk && pinterestProfile && (
            <p className="text-sm text-zinc-500">
              Boards load below for new instances. Use Connect to switch Pinterest accounts.
            </p>
          )}
        </section>

        <ConnectModal
          open={connectModalOpen}
          canDismiss
          authed
          onClose={() => setConnectModalOpen(false)}
          onGoogleSuccess={async (cred) => {
            await handleGoogleSuccess(cred);
            setConnectModalOpen(false);
          }}
          onPinterest={() => {
            connectPinterest();
          }}
          googleConfigured={googleConfigured}
          loginForm={null}
          errorMessage={connectModalOpen ? error : null}
        />

        <section className="space-y-6">
            <form onSubmit={createInstance} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 grid gap-4 md:grid-cols-2">
              <h2 className="text-lg font-medium md:col-span-2">New instance</h2>
              <input
                placeholder="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              />
              <select
                value={newBoardId}
                onChange={(e) => setNewBoardId(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-zinc-100"
              >
                <option value="">Select board…</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Slug (optional)"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 md:col-span-2"
              />
              <button
                type="submit"
                className="rounded-lg bg-white text-zinc-900 py-2 font-medium md:col-span-2"
              >
                Create
              </button>
            </form>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-medium">Instances</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInstanceArchiveView(false)}
                    className={`rounded-full px-3 py-1 text-sm ${!instanceArchiveView ? 'bg-white text-zinc-900' : 'bg-white/5 text-zinc-400'}`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstanceArchiveView(true)}
                    className={`rounded-full px-3 py-1 text-sm ${instanceArchiveView ? 'bg-white text-zinc-900' : 'bg-white/5 text-zinc-400'}`}
                  >
                    Archived
                    {archivedInstanceCount > 0 && (
                      <span className="ml-1.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[11px]">
                        {archivedInstanceCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {!instanceArchiveView && archivedInstanceCount > 0 && (
                  <p className="text-sm text-zinc-400">
                    {archivedInstanceCount} archived — open{' '}
                    <button
                      type="button"
                      className="text-emerald-400/90 underline underline-offset-2 hover:text-emerald-300"
                      onClick={() => setInstanceArchiveView(true)}
                    >
                      Archived
                    </button>{' '}
                    to restore a game.
                  </p>
                )}

              {instanceArchiveView && (
                <p className="text-sm text-zinc-500">
                  Archived games are hidden from the public play URL. Use <strong className="text-zinc-400">Restore</strong>{' '}
                  on a row to move it back to Active.
                </p>
              )}

              {instances.length === 0 && (
                <p className="text-sm text-zinc-500">No instances yet — create one above.</p>
              )}

              {instances.length > 0 &&
                instances.filter((i) => (instanceArchiveView ? i.archivedAt : !i.archivedAt)).length === 0 && (
                  <p className="text-sm text-zinc-500">
                    {instanceArchiveView ? 'No archived instances.' : 'No active instances.'}
                  </p>
                )}

              <ul className="space-y-3">
                {instances
                  .filter((i) => (instanceArchiveView ? !!i.archivedAt : !i.archivedAt))
                  .map((i) => (
                    <li key={i.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{i.name}</p>
                          <p className="text-xs text-zinc-500">
                            {i.pinCount} pins · {i.sessionCount} sessions · last sync{' '}
                            {i.lastSyncedAt ? new Date(i.lastSyncedAt).toLocaleString() : '—'}
                          </p>
                          <p className="text-xs text-zinc-600 mt-1 break-all">/p/{i.slug}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setDrawerInstanceId(i.id)}
                            className="rounded-lg bg-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/15"
                          >
                            Sessions & stats
                          </button>
                          <a
                            href={`/admin/instances/${i.id}`}
                            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-zinc-400 hover:bg-white/10 hover:text-white"
                          >
                            Full page
                          </a>
                          <button
                            type="button"
                            onClick={() => copyLink(i.slug)}
                            className="rounded-lg bg-white/10 px-3 py-2 text-sm"
                          >
                            Copy link
                          </button>
                          <button
                            type="button"
                            onClick={() => syncOne(i.id)}
                            className="rounded-lg bg-emerald-600/80 px-3 py-2 text-sm"
                          >
                            Sync
                          </button>
                          {i.archivedAt ? (
                            <button
                              type="button"
                              onClick={() => setInstanceArchived(i.id, false)}
                              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/15"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setInstanceArchived(i.id, true)}
                              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-zinc-400 hover:text-white"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          </section>
      </div>

      <InstanceInsightsDrawer
        open={drawerInstanceId !== null}
        onClose={() => setDrawerInstanceId(null)}
        instanceId={drawerInstanceId}
        instanceName={drawerInstance?.name ?? 'Instance'}
        instanceSlug={drawerInstance?.slug ?? ''}
      />
    </div>
  );
}
