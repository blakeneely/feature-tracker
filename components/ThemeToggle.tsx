'use client';

import { useEffect, useState } from 'react';

// 'system' follows prefers-color-scheme (no data-theme attribute, nothing
// stored); 'dark' / 'light' force one side via data-theme on <html>. The
// stored value is applied before hydration by the inline script in layout.tsx.
type ThemePref = 'system' | 'dark' | 'light';

const STORAGE_KEY = 'feature-tracker:theme';
const ORDER: ThemePref[] = ['system', 'dark', 'light'];
const LABELS: Record<ThemePref, string> = {
  system: '◐ Auto',
  dark: '● Dark',
  light: '○ Light',
};

export default function ThemeToggle() {
  // Render 'system' on the server; the stored preference is picked up after
  // hydration so server and client markup agree.
  const [pref, setPref] = useState<ThemePref>('system');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') setPref(stored);
  }, []);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    setPref(next);
    if (next === 'system') {
      window.localStorage.removeItem(STORAGE_KEY);
      delete document.documentElement.dataset.theme;
    } else {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.dataset.theme = next;
    }
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      title="Theme — follows the system until you pick one"
      aria-label={`Theme: ${pref}. Click to change.`}
      onClick={cycle}
    >
      {LABELS[pref]}
    </button>
  );
}
