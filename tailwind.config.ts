import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand = navy (primary, trust)
        brand: {
          50: '#f0f4fa',
          100: '#dbe4f1',
          200: '#b8c9e3',
          300: '#8aa6cd',
          400: '#5b7fb1',
          500: '#3a5d96',
          600: '#23437a',
          700: '#16305d',
          800: '#0F1E3D',
          900: '#0a1530',
          950: '#050b1c',
        },
        // Primary alias (kept for legacy class usage)
        primary: {
          50: '#f0f4fa',
          100: '#dbe4f1',
          200: '#b8c9e3',
          300: '#8aa6cd',
          400: '#5b7fb1',
          500: '#3a5d96',
          600: '#23437a',
          700: '#16305d',
          800: '#0F1E3D',
          900: '#0a1530',
        },
        // Accent = refined gold (CTA highlights, badges)
        accent: {
          50: '#fdf8e9',
          100: '#faeec5',
          200: '#f4dc8a',
          300: '#eecb55',
          400: '#e3b835',
          500: '#D4AF37',
          600: '#b08d27',
          700: '#8b6a1d',
          800: '#67501a',
          900: '#4a3a18',
        },
        gold: {
          DEFAULT: '#D4AF37',
          light: '#E3B835',
          dark: '#B08D27',
        },
        navy: {
          DEFAULT: '#0F1E3D',
          light: '#16305d',
          dark: '#0a1530',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 24px -4px rgba(15, 30, 61, 0.18)',
        card: '0 8px 30px -12px rgba(15, 30, 61, 0.18)',
        gold: '0 6px 20px -6px rgba(212, 175, 55, 0.45)',
      },
    },
  },
  plugins: [],
}

export default config
