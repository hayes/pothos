import type { Operation } from '@/components/playground/OperationPane/types';
import type { PlaygroundFile } from '@/components/playground/types';
import { makeOperation } from '@/hooks/playground/useOperations';

export const DEFAULT_CODE = `import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: {
        name: t.arg.string({ required: false }),
      },
      resolve: (_, args) => \`Hello, \${args.name ?? 'World'}!\`,
    }),
  }),
});

export const schema = builder.toSchema();
`;

export const DEFAULT_QUERY = `{
  hello(name: "Pothos")
}
`;

export function defaultFiles(): PlaygroundFile[] {
  return [{ filename: 'schema.ts', content: DEFAULT_CODE }];
}

export function defaultOperations(): Operation[] {
  return [makeOperation({ name: 'GetHello', query: DEFAULT_QUERY, variables: '' })];
}
