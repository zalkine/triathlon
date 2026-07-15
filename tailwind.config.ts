import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  // `dark:` variants follow the OS setting (prefers-color-scheme), matching the
  // CSS-variable palette flip in globals.css. Used sparingly for the few spots
  // that need a distinct dark treatment (e.g. the hero logo lockup).
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // "Ocean" brand palette — blue/teal spin on the original triathlon
        // tokens (run = warm accent, bike = blue, swim = teal). The DEFAULT
        // and `light` shades are the vivid brand colours and stay fixed in
        // both themes; the `-dark` shades and the ink/cream/surface tokens are
        // CSS variables that flip for dark mode (see globals.css).
        run: {
          DEFAULT: '#ec6a52',
          light: '#f4a696',
          dark: 'rgb(var(--run-dark) / <alpha-value>)',
        },
        bike: {
          DEFAULT: '#4f9dd6',
          light: '#a6cded',
          dark: 'rgb(var(--bike-dark) / <alpha-value>)',
        },
        swim: {
          DEFAULT: '#2f9aa0',
          light: '#8fccce',
          dark: 'rgb(var(--swim-dark) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          light: 'rgb(var(--ink-light) / <alpha-value>)',
        },
        cream: 'rgb(var(--cream) / <alpha-value>)',
        // Card / input background. Flips dark so it isn't a glaring white panel
        // on dark-mode phones. Replaces the hardcoded `bg-white` usages.
        surface: 'rgb(var(--surface) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
