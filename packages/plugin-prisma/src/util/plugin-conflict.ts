import SchemaBuilder, { PothosSchemaError } from '@pothos/core';

// Both plugins install the same prisma* methods on the core prototypes. Imported before the
// modules that install ours, so a failed import leaves plugin-prisma-next's in place.
// `plugins` is the registry `registerPlugin` fills; core's default export doesn't type it.
if (Object.hasOwn((SchemaBuilder as unknown as { plugins: object }).plugins, 'prismaNext')) {
  throw new PothosSchemaError(
    '@pothos/plugin-prisma and @pothos/plugin-prisma-next both define builder.prismaObject, ' +
      't.prismaField and the other prisma* methods, so they cannot be used in the same program.',
  );
}
