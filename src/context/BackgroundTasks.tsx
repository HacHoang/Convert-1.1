import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppNotice } from '../components/AppNotice';
import { Loader2 } from 'lucide-react';

type Task = {
  id: string;
  title: string;
  detail: string;
  percent: number;
  updatedAt: number;
  staleAfterMs: number;
};
export type BackgroundTaskControl = { signal: AbortSignal; heartbeat: () => void };
export type BackgroundTaskOptions = { staleAfterMs?: number };
export type AppNotification = { id: string; text: string; error: boolean; createdAt: number };

const DEFAULT_STALE_AFTER_MS = 5 * 60_000;
const MIN_STALE_AFTER_MS = 15_000;
const NOTIFICATION_HISTORY_KEY = 'hermes.notification-history.v1';
const readNotificationHistory = (): AppNotification[] => {
  try {
    const value = JSON.parse(localStorage.getItem(NOTIFICATION_HISTORY_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is AppNotification => !!item && typeof item.id === 'string' && typeof item.text === 'string' && typeof item.error === 'boolean' && typeof item.createdAt === 'number').slice(0, 100);
  } catch { return []; }
};

const Context = createContext<{
  task: Task | null;
  running: boolean;
  notifications: AppNotification[];
  run: (title: string, work: (control: BackgroundTaskControl) => Promise<void>, options?: BackgroundTaskOptions) => void;
  progress: (patch: Partial<Pick<Task, 'detail' | 'percent'>>) => void;
  notify: (text: string, error?: boolean) => void;
  reportResult: (text: string, error?: boolean) => void;
  clearNotifications: () => void;
}>(null!);
export const useBackgroundTasks = () => useContext(Context);

export function BackgroundTaskIndicator() {
  const { task } = useBackgroundTasks();
  if (!task) return null;
  return <div role="status" aria-label={`${task.title}: ${task.percent}%. ${task.detail}`} title={`${task.title} — ${task.detail}`} className="relative flex min-w-0 items-center gap-1.5 rounded-md px-1 py-1.5 text-[11px] text-muted">
    <Loader2 size={12} className="shrink-0 animate-spin text-accent" />
    <span className="hidden min-w-0 flex-1 truncate @min-[768px]/app:inline">{task.title}</span>
    <span className="shrink-0 tabular-nums text-accent">{Math.round(task.percent)}%</span>
    <div role="progressbar" aria-label={task.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={task.percent} className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-full bg-raised"><div className="h-full bg-accent transition-[width]" style={{ width: `${task.percent}%` }} /></div>
  </div>;
}

export function BackgroundTasks({ children }: { children: React.ReactNode }) {
  const [task, setTask] = useState<Task | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>(readNotificationHistory);
  const activeId = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const announced = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const abortActiveTask = () => controller.current?.abort();
    import.meta.hot?.dispose(abortActiveTask);
    return () => {
      clearTimeout(noticeTimer.current);
      abortActiveTask();
    };
  }, []);
  useEffect(() => {
    try { localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(notifications)); }
    catch { /* Notification history is optional when browser storage is unavailable. */ }
  }, [notifications]);

  const notify = useCallback((text: string, error = false) => {
    const normalized = text.trim();
    if (!normalized) return;
    setNotifications(previous => [{ id: crypto.randomUUID(), text: normalized, error, createdAt: Date.now() }, ...previous].slice(0, 100));
    clearTimeout(noticeTimer.current);
    setNotice({ text: normalized, error });
    noticeTimer.current = setTimeout(() => setNotice(null), error ? 6000 : 3500);
  }, []);
  const reportResult = useCallback((text: string, error = false) => {
    announced.current = true;
    notify(text, error);
  }, [notify]);

  const release = useCallback((id: string, abort = false) => {
    if (activeId.current === id) {
      if (abort) controller.current?.abort();
      controller.current = null;
      activeId.current = null;
    }
    setTask(previous => previous?.id === id ? null : previous);
  }, []);

  const progress = useCallback((patch: Partial<Pick<Task, 'detail' | 'percent'>>) => {
    const id = activeId.current;
    if (!id) return;
    setTask(previous => previous?.id === id ? { ...previous, ...patch, updatedAt: Date.now() } : previous);
  }, []);

  const run = useCallback((title: string, work: (control: BackgroundTaskControl) => Promise<void>, options?: BackgroundTaskOptions) => {
    if (activeId.current) {
      notify('Đang có tác vụ dữ liệu chạy. Vui lòng đợi tác vụ này hoàn tất.', true);
      return;
    }
    const id = crypto.randomUUID();
    const taskController = new AbortController();
    const staleAfterMs = Math.max(MIN_STALE_AFTER_MS, options?.staleAfterMs ?? DEFAULT_STALE_AFTER_MS);
    activeId.current = id;
    controller.current = taskController;
    announced.current = false;
    setNotice(null);
    setTask({ id, title, detail: 'Đang chuẩn bị…', percent: 0, updatedAt: Date.now(), staleAfterMs });
    void (async () => {
      try {
        await work({ signal: taskController.signal, heartbeat: () => progress({}) });
        if (activeId.current === id && !announced.current) notify(`${title}: hoàn tất.`);
      } catch (error) {
        // A watchdog timeout already reported the useful error. Ignore the
        // AbortError emitted by the cancelled worker after its lease expired.
        if (activeId.current === id) notify(error instanceof Error ? error.message : 'Tác vụ không hoàn tất.', true);
      } finally {
        release(id);
      }
    })();
  }, [notify, progress, release]);

  // Every task owns a renewable lease. Progress/heartbeat renews it. This also
  // clears legacy tasks left in React state by Fast Refresh before leases existed.
  useEffect(() => {
    if (!task) return;
    if (!task.id || !task.updatedAt || !task.staleAfterMs) {
      controller.current?.abort();
      controller.current = null;
      activeId.current = null;
      setTask(null);
      notify('Đã tự khôi phục tác vụ cũ bị treo sau khi cập nhật ứng dụng.', true);
      return;
    }
    const remaining = task.updatedAt + task.staleAfterMs - Date.now();
    const timeout = setTimeout(() => {
      if (activeId.current !== task.id) return;
      release(task.id, true);
      notify(`${task.title} đã tự dừng vì không phản hồi. Bạn có thể chạy lại ngay.`, true);
    }, Math.max(0, remaining));
    return () => clearTimeout(timeout);
  }, [task, notify, release]);

  const value = useMemo(() => ({
    task,
    running: !!task,
    notifications,
    run,
    progress,
    notify,
    reportResult,
    clearNotifications: () => setNotifications([]),
  }), [task, notifications, run, progress, notify, reportResult]);

  return <Context.Provider value={value}>
    {children}
    <div data-app-notice-stack className="pointer-events-none absolute inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top))] z-[120] mx-auto max-w-md space-y-2 @min-[768px]/app:top-16" aria-live="polite">
      {notice && <AppNotice error={notice.error} onClose={() => setNotice(null)} className="pointer-events-auto">{notice.text}</AppNotice>}
    </div>
  </Context.Provider>;
}
