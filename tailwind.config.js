/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Bitcoin Echo brand colors - using CSS variables for theme support
        echo: {
          bg: 'var(--color-bg)',
          elevated: 'var(--color-bg-elevated)',
          surface: 'var(--color-surface)',
          border: 'var(--color-border)',
          text: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
          dim: 'var(--color-text-dim)',
          accent: 'var(--color-accent)'
        }
      },
      fontFamily: {
        serif: ['Libre Baskerville', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        mono: ['Courier Prime', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace']
      },
      fontSize: {
        'xs': ['0.8125rem', { lineHeight: '1.5' }],   // 13px (was 12px)
        'sm': ['0.9375rem', { lineHeight: '1.6' }],   // 15px (was 14px)
        'base': ['1.0625rem', { lineHeight: '1.7' }], // 17px (was 16px)
        'lg': ['1.1875rem', { lineHeight: '1.6' }],   // 19px
        'xl': ['1.375rem', { lineHeight: '1.5' }],    // 22px
        '2xl': ['1.625rem', { lineHeight: '1.4' }],   // 26px
        '3xl': ['2rem', { lineHeight: '1.3' }],       // 32px
        '4xl': ['2.5rem', { lineHeight: '1.2' }]      // 40px
      },
      letterSpacing: {
        'tight': '-0.01em',
        'wide': '0.08em',
        'wider': '0.12em'
      }
    }
  },
  plugins: []
};
