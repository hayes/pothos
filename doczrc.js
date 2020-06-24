export default {
  typescript: true,
  title: 'GiraphQL',
  dest: './dist',
  files: './docs/**/*.{md,markdown,mdx}',
  themeConfig: {
    mode: 'dark',
  },
  menu: [
    'Overview',
    {
      name: 'Guide',
      menu: [
        'Getting Started',
        'Object Types',
        'SchemaBuilder',
        'Defining Fields',
        'Defining Arguments',
        'Using Context',
        'Input Types',
        'Enum Types',
        'Scalar Types',
        'Interface Types',
        'Union Types',
        'Printing schemas',
      ],
    },
    { name: 'Api', menu: ['SchemaBuilder', 'FieldBuilder', 'InputFieldBuilder'] },
    'Schema converter',
  ],
};
