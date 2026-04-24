/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Semantic tokens
        primary: '#2563eb',       // blue-600
        'primary-dark': '#60a5fa', // blue-400
        destructive: '#dc2626',   // red-600
        // Event type colors
        fuel: '#14b8a6',          // teal-500
        service: '#f97316',       // orange-500
        expense: '#10b981',       // emerald-500
      },
    },
  },
  plugins: [],
};
