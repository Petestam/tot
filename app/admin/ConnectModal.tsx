'use client';

import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';

type ConnectModalProps = {
  open: boolean;
  onClose: () => void;
  /** When false, backdrop/close hidden (must sign in first). */
  canDismiss: boolean;
  authed: boolean;
  onGoogleSuccess: (cred: CredentialResponse) => void | Promise<void>;
  onPinterest: () => void;
  /** Login form when not authed */
  loginForm?: React.ReactNode | null;
  /** Shown under Google when authed (e.g. API errors) */
  errorMessage?: string | null;
  googleConfigured: boolean;
};

export function ConnectModal({
  open,
  onClose,
  canDismiss,
  authed,
  onGoogleSuccess,
  onPinterest,
  loginForm,
  errorMessage,
  googleConfigured,
}: ConnectModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => {
          if (canDismiss) onClose();
        }}
        aria-label={canDismiss ? 'Close' : undefined}
        aria-hidden={!canDismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-modal-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 id="connect-modal-title" className="text-lg font-semibold text-white">
            {authed ? 'Connect integrations' : 'Sign in'}
          </h2>
          {canDismiss && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              Close
            </button>
          )}
        </div>

        {errorMessage && (
          <p className="mb-4 text-sm text-red-400" role="alert">
            {errorMessage}
          </p>
        )}

        {googleConfigured ? (
          <div className="mb-6 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Google</p>
            <div className="flex w-full max-w-full justify-center overflow-hidden [&>div]:!w-full [&>div]:!max-w-full">
              <GoogleLogin
                onSuccess={onGoogleSuccess}
                onError={() => {
                  /* user closed popup */
                }}
                useOneTap={false}
                ux_mode="popup"
                theme="filled_black"
                size="large"
                width={340}
                text="continue_with"
                shape="rectangular"
              />
            </div>
            <p className="text-xs text-zinc-500">
              Opens in a popup. Allowed emails are set in <code className="text-zinc-400">GOOGLE_ALLOWED_EMAILS</code>.
            </p>
          </div>
        ) : (
          <p className="mb-4 text-sm text-amber-200/90">
            Set <code className="text-xs">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> and{' '}
            <code className="text-xs">GOOGLE_CLIENT_ID</code> to enable Google sign-in.
          </p>
        )}

        {!authed && loginForm ? (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-zinc-900 px-2 text-zinc-500">or use password</span>
              </div>
            </div>
            {loginForm}
          </>
        ) : null}

        {authed && (
          <div className="space-y-3 border-t border-white/10 pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Pinterest</p>
            <p className="text-sm text-zinc-400">
              Opens Pinterest OAuth in a new tab. After authorizing, return here and refresh if boards don’t load.
            </p>
            <button
              type="button"
              onClick={() => {
                onPinterest();
              }}
              className="w-full rounded-lg bg-[#e60023] text-white py-3 text-sm font-medium hover:bg-[#c2001e]"
            >
              Connect Pinterest
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
