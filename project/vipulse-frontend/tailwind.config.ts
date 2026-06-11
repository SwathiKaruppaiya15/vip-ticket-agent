import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand (violet/indigo/cyan gradient system) ──────────────────────
        brand: {
          DEFAULT: '#7C3AED',
          dark:    '#6D28D9',
          light:   '#8B5CF6',
          muted:   '#1E1B4B',
          50:      '#F5F3FF',
        },
        accent: {
          DEFAULT: '#06B6D4',
          dark:    '#0891B2',
          light:   '#22D3EE',
        },
        // ── App surfaces (dark) ─────────────────────────────────────────────
        app: {
          bg:       '#0F172A',
          surface:  '#111827',
          card:     '#111827',
          elevated: '#1E293B',
          border:   'rgba(255,255,255,0.07)',
          'border-strong': 'rgba(255,255,255,0.12)',
        },
        // ── Sidebar ──────────────────────────────────────────────────────────
        sidebar: {
          bg:     '#0B1120',
          hover:  '#141e33',
          active: '#1a2540',
          border: 'rgba(255,255,255,0.06)',
          text:   '#94A3B8',
          muted:  '#475569',
          label:  '#1E293B',
        },
        // ── Priority ─────────────────────────────────────────────────────────
        critical: { DEFAULT: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' },
        high:     { DEFAULT: '#F97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)' },
        medium:   { DEFAULT: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
        low:      { DEFAULT: '#22C55E', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.25)' },
        // ── VIP tiers ────────────────────────────────────────────────────────
        vip: {
          gold:     '#F59E0B',
          platinum: '#A78BFA',
          silver:   '#94A3B8',
        },
        // ── Semantic ─────────────────────────────────────────────────────────
        success: { DEFAULT: '#22C55E', muted: 'rgba(34,197,94,0.12)' },
        warning: { DEFAULT: '#F59E0B', muted: 'rgba(245,158,11,0.12)' },
        danger:  { DEFAULT: '#EF4444', muted: 'rgba(239,68,68,0.12)' },
        info:    { DEFAULT: '#06B6D4', muted: 'rgba(6,182,212,0.12)' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-brand':   'linear-gradient(135deg, #7C3AED 0%, #4F46E5 45%, #06B6D4 100%)',
        'gradient-brand-r': 'linear-gradient(135deg, #06B6D4 0%, #4F46E5 55%, #7C3AED 100%)',
        'gradient-card':    'linear-gradient(145deg, #1a2035 0%, #111827 100%)',
        'gradient-glow':    'radial-gradient(ellipse at top, rgba(124,58,237,0.15) 0%, transparent 60%)',
        'gradient-mesh':    'radial-gradient(at 40% 20%, rgba(124,58,237,0.08) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(6,182,212,0.05) 0px, transparent 50%)',
        'dot-pattern':      'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
        'grid-pattern':     'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        'dot-sm':  '20px 20px',
        'dot-md':  '32px 32px',
        'grid-md': '40px 40px',
      },
      boxShadow: {
        'card':        '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-md':     '0 4px 16px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.3)',
        'card-lg':     '0 12px 40px rgba(0,0,0,0.5)',
        'glow-brand':  '0 0 24px rgba(124,58,237,0.35), 0 0 48px rgba(124,58,237,0.15)',
        'glow-accent': '0 0 24px rgba(6,182,212,0.25)',
        'glow-sm':     '0 0 12px rgba(124,58,237,0.2)',
        'inner-glow':  'inset 0 1px 0 rgba(255,255,255,0.06)',
        'brand-btn':   '0 4px 15px rgba(124,58,237,0.4), 0 0 0 1px rgba(124,58,237,0.3)',
        'toast':       '0 8px 30px rgba(0,0,0,0.5)',
      },
      animation: {
        'fade-in':      'fadeIn 0.2s ease-out',
        'fade-in-up':   'fadeInUp 0.3s ease-out',
        'fade-in-down': 'fadeInDown 0.25s ease-out',
        'slide-up':     'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-r':   'slideInRight 0.25s ease-out',
        'scale-in':     'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer':      'shimmer 2s linear infinite',
        'pulse-slow':   'pulse 3s ease-in-out infinite',
        'float':        'float 3s ease-in-out infinite',
        'glow-pulse':   'glowPulse 2s ease-in-out infinite',
        'stagger-in':   'fadeIn 0.4s ease-out both',
        'border-spin':  'borderSpin 3s linear infinite',
      },
      keyframes: {
        fadeIn:       { from: { opacity: '0' }, to: { opacity: '1' } },
        fadeInUp:     { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeInDown:   { from: { opacity: '0', transform: 'translateY(-6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideUp:      { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        scaleIn:      { from: { opacity: '0', transform: 'scale(0.94)' }, to: { opacity: '1', transform: 'scale(1)' } },
        shimmer:      { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        float:        { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        glowPulse:    { '0%,100%': { opacity: '0.5' }, '50%': { opacity: '1' } },
        borderSpin:   { from: { '--border-angle': '0deg' }, to: { '--border-angle': '360deg' } },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
} satisfies Config
