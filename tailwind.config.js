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
        primary: '#3B82F6',
        'primary-light': '#DBEAFE',
        'primary-dark': '#1E3A5F',
        fuel: '#0D9488',
        'fuel-light': '#CCFBF1',
        service: '#F97316',
        'service-light': '#FFF7ED',
        expense: '#10B981',
        'expense-light': '#D1FAE5',
        destructive: '#EF4444',
        'destructive-light': '#FEE2E2',
        warning: '#F59E0B',
        'warning-light': '#FEF3C7',
        success: '#10B981',
        'success-light': '#D1FAE5',
        surface: '#F5F5F7',
        'surface-dark': '#1C1C1E',
        'surface-elevated': '#FFFFFF',
        'surface-elevated-dark': '#2C2C2E',
      },
    },
  },
  plugins: [],
};
