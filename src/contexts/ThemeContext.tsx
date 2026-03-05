import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type ThemeKey = 'dark' | 'light';

export interface ThemeConfig {
  key: ThemeKey;
  label: string;
  // Accent colors (used for buttons, highlights, active states)
  primary: string;
  primaryHover: string;
  primaryBg: string;
  primaryBorder: string;
  primaryText: string;
  primaryShadow: string;
  swatch: string;
  isLight?: boolean;
  // Full page palette as raw CSS values (injected as CSS vars)
  palette: {
    pageBg: string;       // deepest background
    surfaceBg: string;    // nav, sidebars
    cardBg: string;       // cards, modals
    elevatedBg: string;   // inputs, dropdowns
    borderStrong: string; // prominent borders
    borderSoft: string;   // subtle borders
    textPrimary: string;  // headings, key text
    textSecondary: string;// body, labels
    textMuted: string;    // hints, placeholders
    accentRaw: string;    // hex for inline styles
    hoverOverlay: string; // overlay color for hover states
  };
}

export const THEMES: ThemeConfig[] = [
  {
    key: 'dark',
    label: 'Dark',
    primary: 'bg-teal-500',
    primaryHover: 'hover:bg-teal-400',
    primaryBg: 'bg-teal-500/20',
    primaryBorder: 'border-teal-500/40',
    primaryText: 'text-teal-400',
    primaryShadow: 'shadow-teal-500/20',
    swatch: '#0d1526',
    palette: {
      pageBg:        '#030712',
      surfaceBg:     '#060f1c',
      cardBg:        '#0d1526',
      elevatedBg:    '#111827',
      borderStrong:  '#1f2937',
      borderSoft:    '#111827',
      textPrimary:   '#f1f5f9',
      textSecondary: '#94a3b8',
      textMuted:     '#475569',
      accentRaw:     '#14b8a6',
      hoverOverlay:  'rgba(255,255,255,0.05)',
    },
  },
  {
    key: 'light',
    label: 'Light',
    primary: 'bg-teal-500',
    primaryHover: 'hover:bg-teal-600',
    primaryBg: 'bg-teal-500/25',
    primaryBorder: 'border-teal-500/60',
    primaryText: 'text-teal-600',
    primaryShadow: 'shadow-teal-500/20',
    swatch: '#f8fafc',
    isLight: true,
    palette: {
      pageBg:        '#f8fafc',
      surfaceBg:     '#ffffff',
      cardBg:        '#ffffff',
      elevatedBg:    '#f1f5f9',
      borderStrong:  '#c8d5e3',
      borderSoft:    '#dde6f0',
      textPrimary:   '#0f172a',
      textSecondary: '#475569',
      textMuted:     '#94a3b8',
      accentRaw:     '#0d9488',
      hoverOverlay:  'rgba(0,0,0,0.05)',
    },
  },
];

function applyPalette(theme: ThemeConfig) {
  const { palette, isLight } = theme;
  const root = document.documentElement;
  root.style.setProperty('--color-page-bg',        palette.pageBg);
  root.style.setProperty('--color-surface-bg',     palette.surfaceBg);
  root.style.setProperty('--color-card-bg',        palette.cardBg);
  root.style.setProperty('--color-elevated-bg',    palette.elevatedBg);
  root.style.setProperty('--color-border-strong',  palette.borderStrong);
  root.style.setProperty('--color-border-soft',    palette.borderSoft);
  root.style.setProperty('--color-text-primary',   palette.textPrimary);
  root.style.setProperty('--color-text-secondary', palette.textSecondary);
  root.style.setProperty('--color-text-muted',     palette.textMuted);
  root.style.setProperty('--color-accent-raw',     palette.accentRaw);
  root.style.setProperty('--color-hover-overlay',  palette.hoverOverlay);
  if (isLight) {
    root.setAttribute('data-theme-mode', 'light');
  } else {
    root.removeAttribute('data-theme-mode');
  }
}

interface ThemeContextValue {
  theme: ThemeConfig;
  setTheme: (key: ThemeKey) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [themeKey, setThemeKey] = useState<ThemeKey>('dark');

  useEffect(() => {
    const t = THEMES.find((t) => t.key === themeKey) ?? THEMES[0];
    applyPalette(t);
  }, [themeKey]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_preferences')
      .select('theme')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.theme) setThemeKey(data.theme as ThemeKey);
      });
  }, [user]);

  const setTheme = useCallback(async (key: ThemeKey) => {
    setThemeKey(key);
    if (!user) return;
    await supabase.from('user_preferences').upsert({ user_id: user.id, theme: key, updated_at: new Date().toISOString() });
  }, [user]);

  const theme = THEMES.find((t) => t.key === themeKey) ?? THEMES[0];

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
