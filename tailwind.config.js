/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand accent
        primary: '#3B82F6',
        'primary-light': '#DBEAFE',
        'primary-dark': '#1E3A5F',

        // Event types
        fuel: '#0D9488',
        'fuel-light': '#CCFBF1',
        service: '#F97316',
        'service-light': '#FFF7ED',
        expense: '#10B981',
        'expense-light': '#D1FAE5',

        // Semantic
        destructive: '#EF4444',
        'destructive-light': '#FEE2E2',
        warning: '#F59E0B',
        'warning-light': '#FEF3C7',
        success: '#10B981',
        'success-light': '#D1FAE5',

        // Warm neutral surfaces (light)
        surface: '#F5F4F1',
        card: '#FEFDFB',
        divider: '#E2E0DB',
        'divider-subtle': '#F0EFEC',

        // Warm neutral surfaces (dark)
        'surface-dark': '#0E0E0C',
        'card-dark': '#1A1917',
        'divider-dark': '#2A2926',

        // Warm neutral text (light)
        ink: '#1C1B18',
        'ink-secondary': '#5C5A55',
        'ink-muted': '#A8A49D',
        'ink-faint': '#78756F',

        // Warm neutral text (dark)
        'ink-on-dark': '#F5F4F1',
        'ink-secondary-on-dark': '#C5C2BC',
        'ink-muted-on-dark': '#78756F',
        'ink-faint-on-dark': '#54524D',
      },
    },
  },
  plugins: [],
};
