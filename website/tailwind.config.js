const {
  lightBlue,
  warnGray,
  trueGray,
  coolGray,
  blueGray,
  ...colors
  // eslint-disable-next-line node/no-unpublished-require
} = require('tailwindcss/colors');

module.exports = {
  mode: 'jit',
  content: ['./pages/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'media',
  theme: {
    colors: {
      ...colors,
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
    extend: {
      typography: (theme) => ({
        DEFAULT: {
          css: {
            '--tw-prose-invert-body': '#f5f5f5',
            img: {
              marginBottom: '4rem',
            },
            li: {
              img: {
                display: 'inline-block',
                margin: 0,
              },
            },
          },
        },
      }),
    },
  },
  variants: {
    extend: {},
  },
  plugins: [require('@tailwindcss/typography')],
};
