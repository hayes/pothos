import { createPreset } from 'fumadocs-ui/tailwind-plugin';

const darkHue = 165;
const darkContrast = 250;
const lightHue = 100;
const lightContrast = 100;
/** @type {import('fumadocs-ui/tailwind-plugin').Preset} */
const pothosPreset = {
  light: {
    background: `0 0% 98%`,
    foreground: `0 0% 3.9%`,
    muted: `${lightHue} 90% 96.1%`,
    'muted-foreground': `0 0% 45.1%`,
    popover: `0 0% 98%`,
    'popover-foreground': `0 0% 15.1%`,
    card: `${lightHue} 60% 98%`,
    'card-foreground': `0 0% 3.9%`,
    border: `${lightHue} 50% 89.8%`,
    primary: `${lightContrast} 80% 20.2%`,
    'primary-foreground': `0 0% 98%`,
    secondary: `${lightHue} 40% 60%`,
    'secondary-foreground': `0 0% 9%`,
    accent: `${lightHue} 40% 80%`,
    'accent-foreground': `0 0% 9%`,
    ring: `${lightHue} 100% 63.9%`,
  },
  dark: {
    'card-foreground': `${darkHue} 60% 94.5%`,
    'primary-foreground': `0 0% 9%`,
    'secondary-foreground': `${darkHue} 80% 90%`,
    ring: `${darkContrast} 100% 85%`,
    card: `${darkHue} 50% 10%`,
    muted: `${darkHue} 50% 10%`,
    'muted-foreground': `${darkHue} 30% 65%`,
    'accent-foreground': `${darkHue} 80% 90%`,
    popover: `${darkHue} 50% 10%`,
    'popover-foreground': `${darkHue} 30% 65%`,
    accent: `${darkHue} 40% 20%`,
    secondary: `${darkHue} 50% 20%`,
    background: `${darkHue} 60% 6%`,
    foreground: `${darkHue} 60% 94.5%`,
    primary: `${darkContrast} 100% 85%`,
    border: `${darkHue} 50% 20%`,
  },
  css: {
    '.dark body': {
      'background-image': `linear-gradient(rgba(5, 255, 105, 0.05), transparent 20rem, transparent)`,
    },
    'main#nd-docs-layout>div:last-child.sticky': {
      'min-width': '300px !important',
    },
    '#nd-sidebar>div:first-child': {
      display: 'none',
    },
    '@media (max-width: 776px)': {
      '#nd-nav': {
        display: 'none',
      },
    },
    'nav.max-w-container': {
      'max-width': '100%',
    },
    '#nd-docs-layout .prose ul': {
      'list-style-position': 'outside',
      'padding-left': '16px',
    },
    '.light #nd-docs-layout figure.not-prose': {
      background: `hsla(${lightHue} 40% 95%)`,
    },
  },
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './content/**/*.{md,mdx}',
    './mdx-components.{ts,tsx}',
    './node_modules/fumadocs-ui/dist/**/*.js',
  ],
  presets: [
    createPreset({
      preset: pothosPreset,
    }),
  ],
};
