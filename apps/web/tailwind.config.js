/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ["'Geist Mono'", 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted-bg))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        border: 'hsl(var(--border-color))',
        ring: 'hsl(var(--ring))',
        forge: {
          50:  '#fff0f0',
          100: '#ffd6d6',
          200: '#ffaaaa',
          300: '#ff7777',
          400: '#ff4444',
          500: '#cc0000',
          600: '#aa0000',
          700: '#8b0000',
          800: '#660000',
          900: '#400000',
          950: '#1a0000',
        },
      },
      keyframes: {
        'pulse-red': {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.5' },
        },
      },
      animation: {
        'pulse-red': 'pulse-red 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
