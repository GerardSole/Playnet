import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#0d1117',
        main: '#161b22',
        card: '#1c2128',
        border: '#30363d',
        accent: '#14b8a6',
        'accent-hover': '#0d9488',
        muted: '#8b949e',
        danger: '#f85149',
        online: '#3fb950',
        pending: '#d29922',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
