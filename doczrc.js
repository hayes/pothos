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
        'Getting started',
        'SchemaBuilder',
        'Arguments',
        'Object Types',
        'Input Types',
        'Enum Types',
        'Scalars',
        'Interface Types',
        'Union Types',
        'Printing schemas',
      ],
    },
    { name: 'Api', menu: ['SchemaBuilder', 'FieldBuilder', 'InputFieldBuilder'] },
  ],
};
