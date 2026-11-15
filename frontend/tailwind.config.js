/** Tokens de diseño SENDA (los mismos de los mockups). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#D9532B',
        'on-primary': '#161616',
        accent: '#F0875A',
        'on-accent': '#120D0D',
        surface: '#120D0D',
        'surface-container': '#1E1514',
        'surface-container-high': '#2A1E1C',
        'on-surface': '#FFFFFF',
        'on-surface-variant': '#B8A9A7',
        outline: '#3D2B28',
        'outline-variant': '#2B1E1C',
        success: '#22C55E',
        'on-success': '#052E16',
        warning: '#F59E0B',
        'on-warning': '#271A03',
        error: '#EF4444',
        'on-error': '#1C1C1C',
        'route-fast': '#3B82F6',
        'route-safe': '#22C55E',
      },
      spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px' },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        headline: ['"Space Grotesk"', 'sans-serif'],
        title: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Ubuntu"', 'sans-serif'],
        label: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
      fontSize: {
        'display-lg': ['32px', { lineHeight: '38px', letterSpacing: '0.08em', fontWeight: '700' }],
        'headline-lg': ['24px', { lineHeight: '30px', letterSpacing: '0.06em', fontWeight: '700' }],
        'headline-sm': ['18px', { lineHeight: '24px', letterSpacing: '0.05em', fontWeight: '600' }],
        'title-md': ['14px', { lineHeight: '20px', letterSpacing: '0.06em', fontWeight: '600' }],
        'body-md': ['14px', { lineHeight: '20px', letterSpacing: '0em', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '400' }],
        'label-lg': ['13px', { lineHeight: '18px', letterSpacing: '0.08em', fontWeight: '600' }],
        'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.1em', fontWeight: '600' }],
        'mono-md': ['13px', { lineHeight: '18px', letterSpacing: '0.02em', fontWeight: '400' }],
        'mono-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.04em', fontWeight: '400' }],
      },
      transitionDuration: { fast: '150ms', standard: '250ms' },
      transitionTimingFunction: {
        fast: 'cubic-bezier(0.2, 0, 0, 1)',
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-up': 'fade-up 250ms cubic-bezier(0.2, 0, 0, 1) both',
      },
    },
  },
  plugins: [],
};
