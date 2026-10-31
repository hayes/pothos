import SchemaBuilder, { PothosSchemaError } from '@pothos/core';

const conflict =
  '@pothos/plugin-prisma and @pothos/plugin-prisma-next both define builder.prismaObject, ' +
  't.prismaField and the other prisma* methods, so they cannot be used in the same program.';

// The setter can't tell which package is loading, so it names both causes.
const replaced = (name: string) =>
  `Cannot replace ${name}: @pothos/plugin-prisma-next is already loaded. @pothos/plugin-prisma ` +
  'and @pothos/plugin-prisma-next cannot be used in the same program, and only one copy of ' +
  '@pothos/plugin-prisma-next can be installed.';

/**
 * Both plugins install the same method names on the shared core prototypes, and whichever loads
 * last would silently replace the other's. Loading both fails at import instead: here when
 * plugin-prisma is already registered, and in the setter when it loads afterwards.
 */
export function claimPrismaMethods(proto: object, names: readonly string[]) {
  // `plugins` is the registry `registerPlugin` fills; core's default export doesn't type it.
  if (Object.hasOwn((SchemaBuilder as unknown as { plugins: object }).plugins, 'prisma')) {
    throw new PothosSchemaError(conflict);
  }
  for (const name of names) {
    let method = (proto as Record<string, unknown>)[name];
    Object.defineProperty(proto, name, {
      configurable: true,
      get: () => method,
      set: (value: unknown) => {
        // Hosts that re-evaluate plugin modules against one core opt in through this flag.
        if (!SchemaBuilder.allowPluginReRegistration) {
          throw new PothosSchemaError(replaced(name));
        }
        method = value;
      },
    });
  }
}
