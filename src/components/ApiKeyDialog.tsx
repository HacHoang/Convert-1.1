import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, KeyRound, Pencil, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import {
  API_PROVIDERS,
  addApiKey,
  deleteApiKey,
  isApiProviderId,
  listApiKeys,
  maskApiKey,
  providerStorageKey,
  renameApiKey,
  setActiveApiKey,
  type ApiKeyEntry,
  type ApiKeySettings,
  type ApiProviderId,
} from '../utils/apiKeys';

type Props = { onClose: () => void };
const EMPTY_SETTINGS: ApiKeySettings = { entries: [], activeIds: {} };

function providerLabel(entry: ApiKeyEntry): string {
  return entry.providerId === 'custom'
    ? entry.customProviderName || 'Nhà cung cấp khác'
    : API_PROVIDERS[entry.providerId];
}

export function ApiKeyDialog({ onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [frameBounds, setFrameBounds] = useState<DOMRect | null>(null);
  const [settings, setSettings] = useState<ApiKeySettings>(EMPTY_SETTINGS);
  const [providerId, setProviderId] = useState<ApiProviderId>('openai');
  const [customProviderName, setCustomProviderName] = useState('');
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    const frame = document.getElementById('app-frame');
    if (!frame) return;
    const updateBounds = () => setFrameBounds(frame.getBoundingClientRect());
    const observer = new ResizeObserver(updateBounds);
    observer.observe(frame);
    window.addEventListener('resize', updateBounds);
    window.visualViewport?.addEventListener('resize', updateBounds);
    updateBounds();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
      window.visualViewport?.removeEventListener('resize', updateBounds);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    let active = true;
    listApiKeys().then(value => {
      if (active) setSettings(value);
    }).catch(() => {
      if (active) setError('Không đọc được danh sách API key trên thiết bị.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      dialog?.close();
    };
  }, []);

  const saveSettings = async (operation: () => Promise<ApiKeySettings>) => {
    setBusy(true);
    setError('');
    setCopyMessage('');
    try {
      setSettings(await operation());
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không lưu được API key.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const saved = await saveSettings(() => addApiKey(name, key, providerId, customProviderName));
    if (saved) {
      setName('');
      setKey('');
      setCustomProviderName('');
      setProviderId('openai');
    }
  };

  const handleRename = async (entry: ApiKeyEntry) => {
    if (busy) return;
    const saved = await saveSettings(() => renameApiKey(entry.id, editingName));
    if (saved) setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (busy) return;
    if (await saveSettings(() => deleteApiKey(id))) setDeleteId(null);
  };

  const handleCopyKey = async (entry: ApiKeyEntry) => {
    setError('');
    setCopyMessage('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Trình duyệt không hỗ trợ sao chép API key.');
      await navigator.clipboard.writeText(entry.key);
      setCopyMessage(`Đã sao chép key “${entry.name}”.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không sao chép được API key.');
    }
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="api-key-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      style={frameBounds ? {
        left: frameBounds.left + frameBounds.width / 2,
        top: frameBounds.top + frameBounds.height / 2,
        width: Math.min(768, frameBounds.width - 16),
        margin: 0,
        transform: 'translate(-50%, -50%)',
        '--api-dialog-max-height': `${Math.min(frameBounds.height - 16, (window.visualViewport?.height ?? window.innerHeight) - 16)}px`,
      } as React.CSSProperties : undefined}
      className="studio-ui @container/api fixed m-auto max-h-[var(--api-dialog-max-height,calc(100dvh-2rem))] w-[calc(100%-1rem)] max-w-3xl overflow-hidden rounded-2xl border border-line bg-surface p-0 text-main backdrop:bg-black/60"
    >
      <div className="flex max-h-[var(--api-dialog-max-height,calc(100dvh-2rem))] flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4 @min-[640px]/api:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent"><KeyRound size={19} /></div>
            <div>
              <h2 id="api-key-title" className="text-base font-semibold">Quản lý API keys</h2>
              <p className="mt-0.5 text-xs text-muted">Lưu và quản lý khóa từ các nhà cung cấp khác nhau</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng API keys" className="rounded-lg p-2 text-muted hover:bg-raised hover:text-main"><X size={18} /></button>
        </header>

        <main className="min-h-0 space-y-5 overflow-y-auto p-5 @min-[640px]/api:p-7">
          <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5 text-xs text-muted @min-[640px]/api:flex-row @min-[640px]/api:items-start">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-400" />
            <p>API key được lưu trên thiết bị này và không được mã hóa. Người có quyền truy cập hồ sơ thiết bị có thể đọc được khóa. Không lưu key trên thiết bị dùng chung. Các key không được đưa vào bản sao lưu của ứng dụng.</p>
          </div>

          <section aria-labelledby="saved-keys-title" className="space-y-3">
            <div>
              <h3 id="saved-keys-title" className="text-sm font-semibold">API keys đã lưu</h3>
              <p className="mt-1 text-xs text-muted">Mỗi nhà cung cấp có thể có một key mặc định.</p>
            </div>

            <div className="overflow-hidden rounded-xl border border-line">
              <div className="hidden grid-cols-[minmax(0,1.15fr)_minmax(7rem,0.8fr)_minmax(8rem,0.9fr)_auto] gap-3 border-b border-line bg-canvas px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted @min-[640px]/api:grid">
                <span>Tên</span><span>Nhà cung cấp</span><span>API key</span><span className="text-right">Thao tác</span>
              </div>
              {loading ? (
                <p className="px-4 py-7 text-center text-sm text-muted">Đang tải danh sách...</p>
              ) : settings.entries.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <KeyRound size={22} className="mx-auto mb-2 text-muted" />
                  <p className="text-sm text-main">Chưa có API key</p>
                  <p className="mt-1 text-xs text-muted">Thêm key để lưu và quản lý tại đây.</p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {settings.entries.map(entry => {
                    const providerKey = providerStorageKey(entry);
                    const selected = settings.activeIds[providerKey] === entry.id;
                    return (
                      <li key={entry.id} className={`grid gap-3 px-4 py-3.5 @min-[640px]/api:grid-cols-[minmax(0,1.15fr)_minmax(7rem,0.8fr)_minmax(8rem,0.9fr)_auto] @min-[640px]/api:items-center ${selected ? 'bg-accent/5' : 'bg-surface'}`}>
                        <div className="flex min-w-0 items-center gap-3">
                          <button
                            type="button"
                            onClick={() => { if (!selected) void saveSettings(() => setActiveApiKey(entry.id)); }}
                            disabled={busy || selected}
                            aria-label={selected ? `${entry.name} là key mặc định của ${providerLabel(entry)}` : `Đặt ${entry.name} làm key mặc định của ${providerLabel(entry)}`}
                            aria-pressed={selected}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-accent bg-accent text-main' : 'border-line text-transparent hover:border-accent'}`}
                          >
                            {selected && <Check size={12} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            {editingId === entry.id ? (
                              <form className="flex gap-1.5" onSubmit={event => { event.preventDefault(); void handleRename(entry); }}>
                                <input autoFocus value={editingName} onChange={event => setEditingName(event.target.value)} aria-label="Tên API key mới" className="min-w-0 flex-1 rounded-md border border-line bg-canvas px-2 py-1 text-xs text-main focus:border-accent focus:outline-none" />
                                <button type="submit" disabled={busy} aria-label="Lưu tên API key" className="rounded-md p-1.5 text-accent hover:bg-raised"><Check size={14} /></button>
                                <button type="button" onClick={() => setEditingId(null)} aria-label="Hủy sửa tên" className="rounded-md p-1.5 text-muted hover:bg-raised"><X size={14} /></button>
                              </form>
                            ) : (
                              <>
                                <p className="truncate text-sm font-medium text-main">{entry.name}</p>
                                <p className="mt-0.5 text-[11px] text-muted">{selected ? `Key mặc định · ${providerLabel(entry)}` : 'Nhấn để đặt làm key mặc định'}</p>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="pl-8 text-xs text-muted @min-[640px]/api:pl-0">{providerLabel(entry)}</span>
                        <code className="pl-8 text-xs text-muted @min-[640px]/api:pl-0">{maskApiKey(entry.key)}</code>
                        {deleteId === entry.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[11px] text-muted">Xóa key này?</span>
                            <button type="button" onClick={() => void handleDelete(entry.id)} disabled={busy} className="rounded-md px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10">Xóa</button>
                            <button type="button" onClick={() => setDeleteId(null)} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-raised">Hủy</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => void handleCopyKey(entry)} aria-label={`Sao chép key ${entry.name}`} className="rounded-md p-2 text-muted hover:bg-raised hover:text-main"><Copy size={14} /></button>
                            <button type="button" onClick={() => { setEditingId(entry.id); setEditingName(entry.name); setError(''); setCopyMessage(''); }} aria-label={`Đổi tên ${entry.name}`} className="rounded-md p-2 text-muted hover:bg-raised hover:text-main"><Pencil size={14} /></button>
                            <button type="button" onClick={() => { setDeleteId(entry.id); setError(''); setCopyMessage(''); }} aria-label={`Xóa ${entry.name}`} className="rounded-md p-2 text-muted hover:bg-rose-500/10 hover:text-rose-400"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {(error || copyMessage) && (
              <p role={error ? 'alert' : 'status'} className={`text-xs ${error ? 'text-rose-400' : 'text-emerald-400'}`}>
                {error || copyMessage}
              </p>
            )}
          </section>

          <form onSubmit={handleAdd} className="space-y-3 rounded-xl border border-line bg-canvas/50 p-4">
            <div className="flex items-center gap-2">
              <Plus size={15} className="text-accent" />
              <h3 className="text-sm font-semibold">Thêm API key</h3>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs text-muted">Nhà cung cấp</span>
              <select value={providerId} onChange={event => { if (isApiProviderId(event.target.value)) setProviderId(event.target.value); }} className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-main focus:border-accent focus:outline-none">
                <option value="openai">{API_PROVIDERS.openai}</option>
                <option value="claude">{API_PROVIDERS.claude}</option>
                <option value="gemini">{API_PROVIDERS.gemini}</option>
                <option value="custom">Nhà cung cấp khác</option>
              </select>
            </label>
            {providerId === 'custom' && (
              <label className="block space-y-1.5">
                <span className="text-xs text-muted">Tên nhà cung cấp</span>
                <input value={customProviderName} onChange={event => setCustomProviderName(event.target.value)} placeholder="Ví dụ: Mistral, DeepSeek..." maxLength={60} autoComplete="off" className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-main placeholder-subtle focus:border-accent focus:outline-none" />
              </label>
            )}
            <label className="block space-y-1.5">
              <span className="text-xs text-muted">Tên key</span>
              <input value={name} onChange={event => setName(event.target.value)} placeholder="Ví dụ: Tài khoản cá nhân" maxLength={60} autoComplete="off" className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-main placeholder-subtle focus:border-accent focus:outline-none" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-muted">API key</span>
              <input value={key} onChange={event => setKey(event.target.value)} type="password" placeholder="Dán API key" autoComplete="new-password" spellCheck={false} className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-main placeholder-subtle focus:border-accent focus:outline-none" />
            </label>
            <div className="flex justify-end">
              <button type="submit" disabled={busy || loading || !name.trim() || !key.trim() || providerId === 'custom' && !customProviderName.trim()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-main hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
                <Plus size={14} />{busy ? 'Đang lưu...' : 'Lưu API key'}
              </button>
            </div>
          </form>
        </main>
      </div>
    </dialog>,
    document.getElementById('app-frame') || document.body,
  );
}
