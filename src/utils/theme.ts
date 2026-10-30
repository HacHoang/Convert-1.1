import { useEffect, useState } from 'react';

export type ResolvedTheme = 'light' | 'dark' | 'sepia';
export function resolveTheme(theme: string, prefersDark: boolean): ResolvedTheme {
  return theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme === 'light' || theme === 'sepia' ? theme : 'dark';
}

export function useResolvedTheme(theme: string): ResolvedTheme {
  const [prefersDark, setPrefersDark] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setPrefersDark(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return resolveTheme(theme, prefersDark);
}
