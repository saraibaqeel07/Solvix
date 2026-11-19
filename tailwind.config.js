/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#1e1b4b',
        },
      },
      animation: {
        'fade-up':    'fadeUp 0.4s ease-out both',
        'fade-in':    'fadeIn 0.3s ease-out both',
        'slide-left': 'slideLeft 0.3s ease-out both',
        'scale-in':   'scaleIn 0.25s ease-out both',
        'shimmer':    'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeUp:    { '0%': { opacity: 0, transform: 'translateY(16px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        fadeIn:    { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideLeft: { '0%': { opacity: 0, transform: 'translateX(-16px)' }, '100%': { opacity: 1, transform: 'translateX(0)' } },
        scaleIn:   { '0%': { opacity: 0, transform: 'scale(0.95)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      boxShadow: {
        'card':  '0 1px 3px 0 rgb(0 0 0 / .06), 0 1px 2px -1px rgb(0 0 0 / .04)',
        'card-hover': '0 10px 40px -10px rgb(0 0 0 / .12)',
        'glow-indigo': '0 0 30px -5px rgb(99 102 241 / .5)',
        'glow-emerald': '0 0 30px -5px rgb(16 185 129 / .5)',
        'glow-amber':  '0 0 30px -5px rgb(245 158 11 / .5)',
        'glow-rose':   '0 0 30px -5px rgb(239 68 68 / .5)',
      },
    },
  },
  plugins: [],
}
