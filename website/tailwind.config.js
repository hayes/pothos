// eslint-disable-next-line node/no-unpublished-require
const colors = require('tailwindcss/colors');

// eslint-disable-next-line import/no-commonjs
module.exports = {
  mode: 'jit',
  purge: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'media',
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      black: colors.black,
      white: colors.white,
      gray: colors.neutral,
      coolGray: colors.gray,
      green: '#5E854C',
      darkGreen: '#40493B',
      beige: '#A4AE9E',
      blue: '#0089A4',
      sapphire: '#005670',
    },
    extend: {},
  },
  variants: {
    extend: {},
  },
  plugins: [require('@tailwindcss/typography')],
};
