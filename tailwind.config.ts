import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        run: {
          DEFAULT: '#e2725b',
          light: '#f3ad9d',
          dark: '#b8503b',
        },
        bike: {
          DEFAULT: '#eba15a',
          light: '#f6cd9e',
          dark: '#c97e34',
        },
        swim: {
          DEFAULT: '#7fb9a2',
          light: '#b7dcc9',
          dark: '#4f8d74',
        },
        ink: {
          DEFAULT: '#20262b',
          light: '#4a555c',
        },
        cream: '#fbf6ee',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
