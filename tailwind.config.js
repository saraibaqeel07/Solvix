/** @type {import('tailwindcss').Config} */

// ── Pastel palette ────────────────────────────────────────────────────────────
// The standard Tailwind accent palettes are re-mapped to soft pastel tones so the
// whole app (every page using indigo / emerald / amber / rose …) picks up the
// soft theme without touching each component. 50–300 are the pastel fills,
// 400–600 are soft accents, 700–900 stay deep enough for readable text.
const lavender = { 50: '#f6f4ff', 100: '#eeeaff', 200: '#ddd5fe', 300: '#c7bbfb', 400: '#ab9cf3', 500: '#9583ea', 600: '#7f6bd9', 700: '#6553b8', 800: '#4c3f8c', 900: '#2f2860', 950: '#1f1a40' };
const lilac    = { 50: '#fbf5ff', 100: '#f4e8ff', 200: '#e8d3fd', 300: '#d6b5f8', 400: '#c19af0', 500: '#ab7fe3', 600: '#9466cf', 700: '#774fab', 800: '#573b7d', 900: '#382650', 950: '#251935' };
const mint     = { 50: '#effbf5', 100: '#daf5e8', 200: '#b8ead3', 300: '#8fdbb9', 400: '#6cc9a0', 500: '#52b78b', 600: '#3f9c74', 700: '#2f7d5c', 800: '#235e46', 900: '#163d2e', 950: '#0e271d' };
const aqua     = { 50: '#effaf9', 100: '#d8f3f0', 200: '#b3e6e0', 300: '#88d4cc', 400: '#66c1b8', 500: '#4eaaa1', 600: '#3d8f87', 700: '#30726c', 800: '#24564f', 900: '#183935', 950: '#102522' };
const butter   = { 50: '#fffaeb', 100: '#fff1cc', 200: '#ffe39e', 300: '#fcd27a', 400: '#f5bf5c', 500: '#e8a94a', 600: '#cc8e38', 700: '#a3702c', 800: '#7a5421', 900: '#4f3615', 950: '#33230d' };
const peach    = { 50: '#fff6f0', 100: '#ffe8da', 200: '#ffd1b5', 300: '#fcb48e', 400: '#f49a70', 500: '#e9825a', 600: '#cf6a45', 700: '#a85436', 800: '#7d3f29', 900: '#52291b', 950: '#361b12' };
const blush    = { 50: '#fff4f6', 100: '#ffe4ea', 200: '#fecad6', 300: '#f9a8bb', 400: '#f28aa2', 500: '#e5708c', 600: '#cf5a77', 700: '#ab4760', 800: '#803548', 900: '#55232f', 950: '#38171f' };
const coral    = { 50: '#fff5f4', 100: '#ffe5e2', 200: '#fdcbc5', 300: '#f8a99f', 400: '#f08b80', 500: '#e27266', 600: '#c95b50', 700: '#a5483f', 800: '#7b362f', 900: '#51231f', 950: '#351714' };
const powder   = { 50: '#f2f8ff', 100: '#e1effe', 200: '#c5e0fc', 300: '#a1cbf7', 400: '#80b4ef', 500: '#669de2', 600: '#5084c9', 700: '#41699f', 800: '#314f77', 900: '#20334d', 950: '#152233' };

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // remapped defaults → pastel
        indigo: lavender, violet: lavender, purple: lilac,
        emerald: mint, green: mint, teal: aqua,
        amber: butter, yellow: butter, orange: peach,
        rose: blush, pink: blush, red: coral,
        blue: powder, sky: powder,
        // explicit pastel names for new code
        lavender, lilac, mint, aqua, butter, peach, blush, coral, powder,
        brand: lavender,
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
        'card':  '0 1px 3px 0 rgb(101 83 184 / .06), 0 1px 2px -1px rgb(101 83 184 / .04)',
        'card-hover': '0 10px 40px -12px rgb(101 83 184 / .18)',
        'glow-indigo': '0 0 30px -5px rgb(171 156 243 / .55)',
        'glow-emerald': '0 0 30px -5px rgb(108 201 160 / .55)',
        'glow-amber':  '0 0 30px -5px rgb(245 191 92 / .55)',
        'glow-rose':   '0 0 30px -5px rgb(242 138 162 / .55)',
      },
    },
  },
  plugins: [],
}
