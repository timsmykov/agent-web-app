import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';
import { fontFamily } from 'tailwindcss/defaultTheme';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './store/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        border: 'var(--stroke)',
        input: 'var(--panel)',
        ring: 'var(--accent-0)',
        background: 'var(--bg)',
        foreground: colors.zinc[100],
        accent: {
          DEFAULT: 'var(--accent-0)',
          light: 'var(--accent-1)'
        },
        success: 'var(--success)',
        warn: 'var(--warn)',
        danger: 'var(--danger)'
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)'
      },
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans]
      },
      boxShadow: {
        glow: '0 0 30px rgba(107, 92, 255, 0.45)',
        panel: 'var(--shadow)'
      },
      backdropBlur: {
        glass: 'var(--blur)'
      },
      screens: {
        tall: { raw: '(min-height: 900px)' }
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' }
        },
        'slide-up-fade': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'slide-up-fade': 'slide-up-fade 0.4s ease forwards'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};

export default config;
