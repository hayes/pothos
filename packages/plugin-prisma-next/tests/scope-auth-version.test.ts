import { beforeEach, describe, expect, it, vi } from 'vitest';

// Each test registers its own `scopeAuth` plugin, so each loads a fresh copy of core.
async function build() {
  const { default: SchemaBuilder } = await import('@pothos/core');
  const { default: PrismaNextPlugin } = await import('../src');
  const { sampleContract } = await import('./fixtures/runtime');
  const builder = new SchemaBuilder<{ PrismaNextContract: typeof sampleContract }>({
    plugins: ['scopeAuth', PrismaNextPlugin],
    scopeAuth: { authScopes: () => ({}) },
    prismaNext: {
      client: () => {
        throw new Error('not executed');
      },
      // A build-only context, whose codecs are never read.
      context: {
        contract: sampleContract,
        contractCodecs: { forColumn: () => undefined },
        codecDescriptors: { descriptorFor: () => undefined },
      },
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
    await import('@pothos/plugin-scope-auth');
    const toSchema = await build();
    expect(toSchema).not.toThrow();
  });
});
