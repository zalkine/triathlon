import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // "Ocean" brand palette — blue/teal spin on the original triathlon
        // tokens (run = warm accent, bike = blue, swim = teal).
        run: {
          DEFAULT: '#ec6a52',
          light: '#f4a696',
          dark: '#bf4632',
        },
        bike: {
          DEFAULT: '#4f9dd6',
          light: '#a6cded',
          dark: '#2f79ad',
        },
        swim: {
          DEFAULT: '#2f9aa0',
          light: '#8fccce',
          dark: '#1f6d72',
        },
        ink: {
          DEFAULT: '#16323c',
          light: '#47646f',
        },
        cream: '#eef4f4',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
