/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#166534', // Deep green
          hover: '#14532d',
          light: '#DCFCE7',   // Light green
          surface: '#F0FDF4',
        },
        accent: {
          DEFAULT: '#F59E0B', // Warm amber
          hover: '#D97706',
          light: '#FEF3C7',
        },
        surface: {
          DEFAULT: '#FFFFFF', // Pure white card
          bg: '#F8FAFC',      // Slate-50 background
          muted: '#F1F5F9',
        },
        text: {
          primary: '#111827',   // Slate 900
          secondary: '#6B7280', // Gray 500
          muted: '#9CA3AF',
        },
        status: {
          success: '#16A34A',
          danger: '#DC2626',
          warning: '#F59E0B',
          info: '#2563EB',
          'success-bg': '#DCFCE7',
          'danger-bg': '#FEE2E2',
          'warning-bg': '#FEF3C7',
          'info-bg': '#DBEAFE',
        }
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'card': '16px',
        'input': '12px',
        'button': '12px',
        'badge': '9999px',
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(16, 24, 40, 0.05)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.04), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
        'elevated': '0 12px 24px -4px rgba(0, 0, 0, 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 250ms ease-out forwards',
        'fade-up': 'fadeUp 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-subtle': 'pulseSubtle 2.5s infinite ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}
