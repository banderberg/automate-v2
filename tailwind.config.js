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
      borderRadius: {
        card: 20,
      },
      colors: {
        // Brand accent (warm-shifted blue to complement warm neutrals)
        primary: '#4272C4',
        'primary-light': '#DBE6F5',
        'primary-dark': '#1E3554',
        'primary-tint': '#6A9FD8',

        // Event types (warmed to harmonize with neutral palette)
        fuel: '#1A9A8F',
        'fuel-light': '#D0F5EE',
        service: '#E8772B',
        'service-light': '#FFF3E6',
        expense: '#2EAD76',
        'expense-light': '#D5F2E3',

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
        'ink-muted': '#706C67',
        'ink-faint': '#78756F',

        // Warm neutral text (dark)
        'ink-on-dark': '#F5F4F1',
        'ink-secondary-on-dark': '#C5C2BC',
        'ink-muted-on-dark': '#8A8680',
        'ink-faint-on-dark': '#54524D',
      },
    },
  },
  plugins: [],
};
