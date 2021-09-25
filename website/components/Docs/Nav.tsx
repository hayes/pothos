import { TableOfContents } from "../Toc";

export const tableOfContents: TableOfContents = {
  entries: [
    {
      name: 'Overview',
      link: '#overview',
    },
    {
      name: 'Guide',
      link: '#guide',
      children: [
        { name: 'Object Types', link: '#Object-Types' },
        { name: 'SchemaBuilder', link: '#SchemaBuilder' },
        { name: 'Args', link: '#Args' },
        { name: 'Fields', link: '#Fields' },
        { name: 'Context object', link: '#Context-object' },
        { name: 'Input Objects', link: '#Input-Objects' },
        { name: 'Enums', link: '#Enums' },
        { name: 'Scalars', link: '#Scalars' },
        { name: 'Interfaces', link: '#Interfaces' },
        { name: 'Unions', link: '#Unions' },
        { name: 'Using Plugins', link: '#Using-Plugins' },
        { name: 'App layout', link: '#App-layout' },
        { name: 'Patterns', link: '#Patterns' },
        { name: 'Printing Schema', link: '#Printing-Schema' },
        { name: 'Changing Default Nullability', link: '#Changing-Default-Nullability' },
        { name: 'Writing Plugins', link: '#Writing-Plugins' },
        { name: 'Deno', link: '#Deno' },
        { name: 'Troubleshooting', link: '#Troubleshooting' },
      ],
    },
    {
      name: 'Plugins',
      link: '#plugins',
      children: [
        { name: 'Auth', link: '#Auth' },
        { name: 'Dataloader', link: '#Dataloader' },
        { name: 'Directives', link: '#Directives' },
        { name: 'Errors', link: '#Errors' },
        { name: 'Mocks', link: '#Mocks' },
        { name: 'Prisma', link: '#Prisma' },
        { name: 'Relay', link: '#Relay' },
        { name: 'Simple Objects', link: '#Objects' },
        { name: 'Smart Subscriptions', link: '#Subscriptions' },
        { name: 'SubGraph', link: '#SubGraph' },
        { name: 'Validation', link: '#Validation' },
      ],
    },
    {
      name: 'API',
      link: '#api',
      children: [
        { name: 'SchemaBuilder', link: '#SchemaBuilder' },
        { name: 'FieldBuilder', link: '#FieldBuilder' },
        { name: 'ArgBuilder', link: '#ArgBuilder' },
        { name: 'InputFieldBuilder', link: '#InputFieldBuilder' },
      ],
    },
    {
      name: 'Design',
      link: '#design',
    },
    {
      name: 'Migrations',
      link: '#migrations',
      children: [
        {
          name: 'v2.0',
          link: '#v2.0',
        },
      ],
    },
  ],
};

