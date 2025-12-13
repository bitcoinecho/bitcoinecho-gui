/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Bitcoin Echo brand colors (from bitcoinecho.org)
        echo: {
          bg: '#0a0a0a',
          elevated: '#111111',
          surface: '#1a1a1a',
          border: '#2a2a2a',
          text: '#e8e8e8',
          muted: '#888888',
          dim: '#555555'
        },
        // Accent - Bitcoin orange for key highlights
        btc: {
          orange: '#f7931a',
          'orange-light': '#ffb347'
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif']
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 2s linear infinite'
      }
    }
  },
  plugins: []
};
