/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#effaf6', 100: '#d7f2e8', 500: '#17906f', 600: '#0f7a5e', 700: '#0d614c', 900: '#0b3a2f', 950: '#072420' },
      },
    },
  },
  plugins: [],
};
