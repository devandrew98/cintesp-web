/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Marca CINTESP (verde)
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        soft: '0 4px 16px -4px rgb(15 23 42 / 0.08)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      keyframes: {
        // Bolinha "flutuando" (aniversariantes do mês).
        flutua: {
          '0%, 100%': { transform: 'translateY(0) rotate(-3deg)' },
          '50%': { transform: 'translateY(-9px) rotate(3deg)' },
        },
        // Ranking: degrau do pódio subindo, linhas entrando, coroa balançando, brilho do 1º lugar.
        sobePodio: {
          '0%': { transform: 'translateY(60px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        entraLinha: {
          '0%': { transform: 'translateX(-16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        coroa: {
          '0%, 100%': { transform: 'translateY(0) rotate(-6deg)' },
          '50%': { transform: 'translateY(-5px) rotate(6deg)' },
        },
        brilho: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(250, 204, 21, 0.55)' },
          '50%': { boxShadow: '0 0 0 14px rgba(250, 204, 21, 0)' },
        },
      },
      animation: {
        flutua: 'flutua 2.8s ease-in-out infinite',
        'sobe-podio': 'sobePodio 0.9s cubic-bezier(0.22, 1, 0.36, 1) both',
        'entra-linha': 'entraLinha 0.5s ease-out both',
        coroa: 'coroa 2.2s ease-in-out infinite',
        brilho: 'brilho 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
