export type Account = { isLoggedIn: boolean; id?: string; email: string; name: string; avatarUrl?: string };
export type GoogleSignInApi = {
  initialize: (config: { client_id: string; nonce: string; auto_select: boolean; callback: (response: { credential: string }) => void }) => void;
  renderButton: (element: HTMLElement, config: { theme: string; size: string; shape: string; text: string; width: number; locale: string }) => void;
  disableAutoSelect: () => void;
};
declare global { interface Window { google?: { accounts: { id: GoogleSignInApi } } } }

export async function authRequest<T>(route: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/auth/${route}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error('Không kết nối được dịch vụ đăng nhập. Vui lòng thử lại.'); }
  if (!response.ok) throw new Error(data.error || 'Không đăng nhập được. Vui lòng thử lại.');
  return data as T;
}

let sdkPromise: Promise<GoogleSignInApi> | null = null;
export function loadGoogleSignIn(): Promise<GoogleSignInApi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<GoogleSignInApi>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => { clearTimeout(timer); script.remove(); sdkPromise = null; reject(new Error('Không tải được đăng nhập Google. Kiểm tra kết nối rồi thử lại.')); };
    const timer = setTimeout(fail, 12000);
    script.src = 'https://accounts.google.com/gsi/client?hl=vi';
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      if (window.google?.accounts?.id) resolve(window.google.accounts.id);
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return sdkPromise;
}
