import { TableOfContents } from '../Toc';

export const tableOfContents: TableOfContents = {
  entries: [
    {
      name: 'Overview',
      link: '/docs',
    },
    {
      name: 'Guide',
      link: '/docs/guide',
      children: [
        { name: 'Object Types', link: '/docs/guide/objects' },
        { name: 'SchemaBuilder', link: '/docs/guide/schema-builder' },
        { name: 'Args', link: '/docs/guide/args' },
        { name: 'Fields', link: '/docs/guide/fields' },
        { name: 'Context object', link: '/docs/guide/context' },
        { name: 'Input Objects', link: '/docs/guide/inputs' },
        { name: 'Enums', link: '/docs/guide/enums' },
        { name: 'Scalars', link: '/docs/guide/scalars' },
        { name: 'Interfaces', link: '/docs/guide/interfaces' },
        { name: 'Unions', link: '/docs/guide/unions' },
        { name: 'Using Plugins', link: '/docs/guide/using-plugins' },
        { name: 'App layout', link: '/docs/guide/app-layout' },
        { name: 'Patterns', link: '/docs/guide/patterns' },
        { name: 'Printing Schema', link: '/docs/guide/printing-schemas' },
        { name: 'Changing Default Nullability', link: '/docs/guide/changing-default-nullability' },
        { name: 'Writing Plugins', link: '/docs/guide/writing-plugins' },
        { name: 'Deno', link: '/docs/guide/deno' },
        { name: 'Troubleshooting', link: '/docs/guide/troubleshooting' },
      ],
    },
    {
      name: 'Plugins',
      link: '/docs/plugins',
      children: [
        { name: 'Auth', link: '/docs/plugins/auth' },
        { name: 'Dataloader', link: '/docs/plugins/dataloader' },
        { name: 'Directives', link: '/docs/plugins/directives' },
        { name: 'Errors', link: '/docs/plugins/errors' },
        { name: 'Mocks', link: '/docs/plugins/mocks' },
        { name: 'Prisma', link: '/docs/plugins/prisma' },
        { name: 'Relay', link: '/docs/plugins/relay' },
        { name: 'Simple Objects', link: '/docs/plugins/simple-objects' },
        { name: 'Smart Subscriptions', link: '/docs/plugins/smart-subscriptions' },
        { name: 'SubGraph', link: '/docs/plugins/sub-graph' },
        { name: 'Validation', link: '/docs/plugins/validation' },
      ],
    },
    {
      name: 'API',
      link: '/docs/api',
      children: [
        { name: 'SchemaBuilder', link: '/docs/api/schema-builder' },
        { name: 'FieldBuilder', link: '/docs/api/field-builder' },
        { name: 'ArgBuilder', link: '/docs/api/arg-builder' },
        { name: 'InputFieldBuilder', link: '/docs/api/input-builder' },
      ],
    },
    {
      name: 'Design',
      link: '/docs/design',
    },
    {
      name: 'Migrations',
      link: '/docs/migrations',
      children: [
        {
          name: '/docs/migrations/v2.0',
          link: '/docs/migrations/giraphql-pothos',
        },
      ],
    },
  ],
};
