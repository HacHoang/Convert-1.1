import { useEffect, useRef } from 'react';
import { activeReadingSeconds, localReadingDay, type ReadingDelta } from '../utils/readingStats';

export function useReadingActivity({ bookId, chapterId, epoch, enabled, atEnd, record }: {
  bookId: string; chapterId: string; epoch: string; enabled: boolean; atEnd: () => boolean; record: (delta: ReadingDelta) => void;
}) {
  const latest = useRef({ atEnd, record, chapterId }); latest.current = { atEnd, record, chapterId };
  useEffect(() => {
    if (!enabled || !chapterId) return;
    let previous = performance.now(), lastInteraction = previous, pending = 0, day = localReadingDay();
    let visible = document.visibilityState === 'visible', focused = document.hasFocus();
    let lastAtEnd = false;
    const flush = () => {
      if (pending <= 0) return;
      const seconds = pending; pending = 0;
      latest.current.record({ epoch, bookId, chapterId, day, seconds, atEnd: lastAtEnd });
    };
    const tick = () => {
      const now = performance.now(), nextDay = localReadingDay();
      if (latest.current.chapterId === chapterId) lastAtEnd = latest.current.atEnd();
      const seconds = activeReadingSeconds(now - previous, visible, focused, now - lastInteraction);
      if (nextDay !== day) {
        const wall = new Date();
        const midnight = new Date(wall.getFullYear(), wall.getMonth(), wall.getDate()).getTime();
        const afterMidnight = Math.min(seconds, Math.max(0, (wall.getTime() - midnight) / 1000));
        pending += seconds - afterMidnight; flush(); day = nextDay; pending = afterMidnight;
      } else pending += seconds;
      previous = now;
      if (pending >= 15) flush();
    };
    const interact = () => { lastInteraction = performance.now(); if (latest.current.chapterId === chapterId) lastAtEnd = latest.current.atEnd(); };
    const visibility = () => { tick(); flush(); visible = document.visibilityState === 'visible'; previous = performance.now(); };
    const focus = () => { previous = performance.now(); lastInteraction = previous; focused = true; };
    const blur = () => { tick(); flush(); focused = false; };
    const hide = () => { tick(); flush(); visible = false; };
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', focus); window.addEventListener('blur', blur); window.addEventListener('pagehide', hide);
    for (const event of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']) document.addEventListener(event, interact, { capture: true, passive: true });
    return () => {
      clearInterval(timer); tick(); flush();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', focus); window.removeEventListener('blur', blur); window.removeEventListener('pagehide', hide);
      for (const event of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']) document.removeEventListener(event, interact, true);
    };
  }, [bookId, chapterId, epoch, enabled]);
}
