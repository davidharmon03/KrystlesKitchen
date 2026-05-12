/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        moss: {
          50:  '#f2f7f4',
          100: '#e0ece4',
          200: '#c2d9cb',
          300: '#95bda5',
          400: '#659a7d',
          500: '#4d7c59',
          600: '#3d6b4a',
          700: '#32573c',
          800: '#284531',
          900: '#1e3424',
        },
        terra: {
          50:  '#fdf5f0',
          100: '#fae6d9',
          200: '#f5c9b0',
          300: '#eda47e',
          400: '#e37a4d',
          500: '#c4622d',
          600: '#b35525',
          700: '#94461e',
          800: '#783a1b',
          900: '#5e2e14',
        },
        cream: '#faf7f2',
        parchment: '#f5edd8',
        ink: '#2d2926',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
