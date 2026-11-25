/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Exact Midnight Editorial dark palette ────────
        // Picked from Stitch screenshots
        night: {
          950: '#0a0a14',
          900: '#13131f',   // main page bg  (#13131f)
          800: '#1a1a2e',   // card bg
          700: '#22223a',   // elevated card
          600: '#2d2d4a',   // borders / dividers
          500: '#3b3b5e',   // hover states
          400: '#5050a0',   // subtle bg tints
          300: '#7070b0',   // placeholder / muted text
          200: '#9898c0',   // secondary text
          100: '#c8c8e0',   // tertiary / caption
          50:  '#eeeef8',   // near-white
        },
        // ── Vivid indigo — exact CTA color ──────────────
        vivid: {
          900: '#1a1050',
          800: '#231478',
          700: '#2e1da0',
          600: '#3f2dd0',
          500: '#5B57FF',   // primary button — exact from Stitch
          400: '#7571ff',
          300: '#9d9aff',
          200: '#c4c2ff',
          100: '#e8e7ff',
          50:  '#f4f3ff',
        },
        // ── Kept for compatibility ──────────────────────
        primary: {
          50:  '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
          400: '#818cf8', 500: '#6366f1', 600: '#4F46E5', 700: '#4338CA',
          800: '#3730a3', 900: '#312e81',
        },
        accent: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
          400: '#34d399', 500: '#10B981', 600: '#059669', 700: '#047857',
        },
        surface: {
          50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1',
          400: '#94A3B8', 500: '#64748B', 600: '#475569', 700: '#334155',
          800: '#1E293B', 900: '#0F172A',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        'card':    '0 1px 3px 0 rgba(0,0,0,0.5)',
        'card-md': '0 4px 12px -2px rgba(0,0,0,0.6)',
        'card-lg': '0 12px 30px -4px rgba(0,0,0,0.7)',
        'glow':    '0 0 28px rgba(91,87,255,0.35)',
        'glow-sm': '0 0 14px rgba(91,87,255,0.2)',
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.45s ease-out',
        'spin-slow':  'spin 1.5s linear infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(18px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
      },
    },
  },
  plugins: [],
}
