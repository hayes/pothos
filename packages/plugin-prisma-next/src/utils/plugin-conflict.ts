import SchemaBuilder, { PothosSchemaError } from '@pothos/core';

// Both plugins install the same prisma* builder methods, so importing one after the other throws.
// Core doesn't type the `plugins` registry on its default export.
if (Object.hasOwn((SchemaBuilder as unknown as { plugins: object }).plugins, 'prisma')) {
  throw new PothosSchemaError(
    '@pothos/plugin-prisma and @pothos/plugin-prisma-next both define builder.prismaObject, ' +
      't.prismaField and the other prisma* methods, so they cannot be used in the same program.',
  );
}
