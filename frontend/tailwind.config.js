/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        dark: '#1e293b',
        darker: '#0f172a',
        surface: '#f5f6fb',
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgb(0 0 0 / 0.06)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 8px 24px -4px rgb(0 0 0 / 0.12), 0 4px 8px -4px rgb(0 0 0 / 0.06)',
        'float': '0 16px 48px -8px rgb(0 0 0 / 0.18), 0 6px 16px -4px rgb(0 0 0 / 0.08)',
        'glow': '0 0 0 3px rgb(99 102 241 / 0.15)',
        'glow-violet': '0 4px 20px -2px rgb(139 92 246 / 0.35)',
        'primary': '0 4px 14px -2px rgb(79 70 229 / 0.30)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        'gradient-hero': 'linear-gradient(135deg, #4338ca 0%, #6d28d9 50%, #7c3aed 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(79,70,229,0.05) 0%, rgba(139,92,246,0.05) 100%)',
      },
      animation: {
        'fade-up': 'fadeUp 0.2s ease-out both',
        'slide-in': 'slideIn 0.28s cubic-bezier(.25,.46,.45,.94) both',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { transform: 'translateX(-100%)' },
          to:   { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
