import { beforeEach, describe, expect, it, vi } from 'vitest';

// Imported through a variable so tsc doesn't load scope-auth's global types, which would require
// `scopeAuth` options in the other test files tsconfig.type.json checks.
const scopeAuth: string = '@pothos/plugin-scope-auth';

// Each test registers its own `scopeAuth` plugin, so each loads a fresh copy of core.
async function build() {
  const { default: SchemaBuilder } = await import('@pothos/core');
  const { default: prismaNextPlugin } = await import('../src');
  const { buildOnlyContext, sampleContract } = await import('./fixtures/helpers');
  const builder = new SchemaBuilder<{ PrismaNextContract: typeof sampleContract }>({
    plugins: ['scopeAuth' as never, prismaNextPlugin],
    prismaNext: {
      client: () => {
        throw new Error('not executed');
      },
      context: buildOnlyContext(sampleContract),
    },
  });
  builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
  builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
  return () => builder.toSchema();
}

describe('@pothos/plugin-scope-auth versions', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('rejects a scope-auth that does not read the parent prisma-next loads', async () => {
    const { default: SchemaBuilder, BasePlugin } = await import('@pothos/core');
    // Stands in for scope-auth 4.2 and older.
    SchemaBuilder.registerPlugin('scopeAuth' as never, class extends BasePlugin<never> {} as never);
    const toSchema = await build();
    expect(toSchema).toThrow('@pothos/plugin-scope-auth 4.3.0 or newer');
  });

  it('builds with the current scope-auth', async () => {
    await import(scopeAuth);
    const toSchema = await build();
    expect(toSchema).not.toThrow();
  });
});
