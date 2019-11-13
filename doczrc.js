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
        'Object Types',
        'Defining Fields',
        'Arguments',
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
