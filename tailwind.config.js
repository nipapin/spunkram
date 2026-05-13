/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    './src/renderer/src/**/*.{vue,js,ts,jsx,tsx}',
    './src/renderer/index.html'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9'
        },
        secondary: '#64748b',
        accent: '#A78BFA',

        success: {
          400: '#34D399',
          500: '#10B981',
          600: '#059669'
        },
        warning: '#f59e0b',
        danger: {
          500: '#ef4444',
          600: '#dc2626'
        },

        background: '#0B0B14',
        surface: '#14141F',
        text: '#F5F5F7',
        'text-muted': '#9CA3AF'
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif'
        ]
      },
      borderRadius: {
        '4xl': '2rem'
      },
      boxShadow: {
        glow: '0 0 60px -12px rgba(124, 58, 237, 0.45)',
        'glow-sm': '0 0 30px -8px rgba(124, 58, 237, 0.35)'
      },
      backgroundImage: {
        'grid-pattern':
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='none' stroke='rgba(255,255,255,0.04)' stroke-width='1'%3E%3Cpath d='M0 0H80M0 40H80M0 80H80'/%3E%3Cpath d='M0 0V80M40 0V80M80 0V80'/%3E%3C/g%3E%3C/svg%3E\")"
      }
    }
  },
  plugins: []
}
