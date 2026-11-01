import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';

type Task = { title: string; detail: string; percent: number };
const Context = createContext<{
  task: Task | null;
  running: boolean;
  run: (title: string, work: () => Promise<void>) => void;
  progress: (patch: Partial<Task>) => void;
  notify: (text: string, error?: boolean) => void;
  reportResult: (text: string, error?: boolean) => void;
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
  const active = useRef(false);
  const announced = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const notify = (text: string, error = false) => {
    clearTimeout(timer.current); setNotice({ text, error });
    timer.current = setTimeout(() => setNotice(null), error ? 15000 : 10000);
  };
  const reportResult = (text: string, error = false) => { announced.current = true; notify(text, error); };
  const run = (title: string, work: () => Promise<void>) => {
    if (active.current) { notify('Đang có tác vụ dữ liệu chạy. Vui lòng đợi tác vụ này hoàn tất.', true); return; }
    active.current = true; announced.current = false; setNotice(null);
    setTask({ title, detail: 'Đang chuẩn bị…', percent: 0 });
    void (async () => {
      try { await work(); if (!announced.current) notify(`${title}: hoàn tất.`); }
      catch (error) { notify(error instanceof Error ? error.message : 'Tác vụ không hoàn tất.', true); }
      finally { active.current = false; setTask(null); }
    })();
  };
  return <Context.Provider value={{ task, running: !!task, run, progress: patch => setTask(previous => previous ? { ...previous, ...patch } : null), notify, reportResult }}>
    {children}
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[80] mx-auto max-w-md space-y-2" aria-live="polite">
      {notice && <div role={notice.error ? 'alert' : 'status'} className="pointer-events-auto flex items-start gap-2 rounded-xl border border-line bg-surface p-3 text-xs shadow-xl">
        {notice.error ? <X size={15} className="shrink-0 text-red-400" /> : <Check size={15} className="shrink-0 text-accent" />}<p className="min-w-0 flex-1 break-words">{notice.text}</p><button aria-label="Đóng thông báo tác vụ" onClick={() => setNotice(null)} className="text-muted"><X size={14} /></button>
      </div>}
    </div>
  </Context.Provider>;
}
