import { Capacitor, registerPlugin } from '@capacitor/core';

type SourcePage = { url: string; html: string };
const browser = registerPlugin<{ open(options: { url: string }): Promise<SourcePage>; close(): Promise<void> }>('SourceBrowser');
declare global { interface Window { hermesSourceBrowser?: { open(url: string): Promise<SourcePage>; close(): Promise<void> } } }
export const hasSourceBrowser = () => !!window.hermesSourceBrowser || Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('SourceBrowser');

export async function readInSourceBrowser(url: string, signal?: AbortSignal): Promise<SourcePage> {
  if (!hasSourceBrowser()) throw new Error('Trình duyệt đọc trang có trong bản Hermes PC và Android. Bản web chưa hỗ trợ đọc trang ngoài trong cùng cửa sổ.');
  const parsed = new URL(url);
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('URL trang không hợp lệ.');
  signal?.throwIfAborted();
  const desktop = window.hermesSourceBrowser;
  const cancel = () => { void (desktop ? desktop.close() : browser.close()).catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const page = await (desktop ? desktop.open(parsed.href) : browser.open({ url: parsed.href }));
    signal?.throwIfAborted();
    return page;
  } finally { signal?.removeEventListener('abort', cancel); }
}
