/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    './src/renderer/src/**/*.{vue,js,ts,jsx,tsx}',
    './src/renderer/index.html'
  ],
  theme: {
    extend: {
      colors: {
        // Основные цвета без оттенков

        primary: {
          400: '#60a5fa',
          500: '#ccff00', // Основной цвет primary
          600: '#99cc00'
        },
        // primary: '#3b82f6', // Синий
        secondary: '#64748b', // Серый
        accent: '#d946ef', // Фиолетовый

        // Семантические цвета

        success: {
          400: '#ccff00',
          500: '#ccff00', // Основной цвет primary
          600: '#ccff00'
        },
        // success: '#22c55e', // Зеленый
        warning: '#f59e0b', // Оранжевый
        // danger: '#ef4444', // Красный

        danger: {
          500: '#ef4444',
          600: '#dc2626'
        },

        // Нейтральные цвета
        background: '#0e0f11', // Белый фон
        surface: '#f8fafc', // Светло-серый фон для карточек
        text: '#171717', // Основной текст
        'text-muted': '#737373' // Приглушенный текст
      }
    }
  },
  plugins: []
}
