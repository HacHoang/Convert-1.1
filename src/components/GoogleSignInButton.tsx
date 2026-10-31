import React, { useEffect, useRef, useState } from 'react';
import { authRequest, loadGoogleSignIn } from '../utils/googleAuth';
import { useApp } from '../context/AppContext';
import { useResolvedTheme } from '../utils/theme';
import { isServerApiUnavailable } from '../utils/serverApi';

export function GoogleSignInButton({ onCredential }: { onCredential: (credential: string, csrf: string) => Promise<void> }) {
  const { settings } = useApp();
  const theme = useResolvedTheme(settings.theme);
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  callback.current = onCredential;
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus('loading'); setError('');
    if (host.current) host.current.replaceChildren();
    (async () => {
      try {
        const config = await authRequest<{ configured: boolean; clientId: string; nonce: string; csrf: string }>('config');
        if (!active) return;
        if (!config.configured) { setStatus('unconfigured'); return; }
        const google = await loadGoogleSignIn();
        if (!active || !host.current) return;
        google.initialize({ client_id: config.clientId, nonce: config.nonce, auto_select: false, callback: async response => {
          if (!active) return;
          setStatus('verifying');
          try { await callback.current(response.credential, config.csrf); }
          catch (error) { if (active) { setError(error instanceof Error ? error.message : 'Không đăng nhập được.'); setStatus('error'); } }
        } });
        google.renderButton(host.current, { theme: theme === 'dark' ? 'filled_black' : 'outline', size: 'large', shape: 'rectangular', text: 'signin_with', width: Math.min(400, host.current.clientWidth), locale: 'vi' });
        setStatus('ready');
      } catch (error) {
        if (active) { setError(error instanceof Error ? error.message : 'Không đăng nhập được.'); setStatus(isServerApiUnavailable(error) ? 'unavailable' : 'error'); }
      }
    })();
    return () => { active = false; };
  }, [attempt, theme]);

  return <div className="space-y-2">
    <div ref={host} className={`w-full ${status === 'ready' ? 'min-h-10' : 'h-0 overflow-hidden'}`} />
    {status !== 'ready' && <button type="button" disabled={status === 'loading' || status === 'verifying' || status === 'unavailable'} onClick={() => status === 'unconfigured' ? setError('Đăng nhập Google chưa được cấu hình.') : setAttempt(n => n + 1)} className="w-full min-h-10 rounded-lg border border-line bg-raised/40 px-3 py-2 text-xs text-main">
      {status === 'loading' ? 'Đang tải đăng nhập…' : status === 'verifying' ? 'Đang xác minh…' : status === 'unavailable' ? 'Cần máy chủ API' : status === 'error' ? 'Thử đăng nhập lại' : 'Đăng nhập với Google'}
    </button>}
    {error && <p role="alert" className="text-[11px] leading-relaxed text-rose-300">{error}</p>}
  </div>;
}
