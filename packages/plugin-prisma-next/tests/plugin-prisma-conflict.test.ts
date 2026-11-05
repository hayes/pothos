import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

// Imported through a variable so tsc doesn't load plugin-prisma's global types, which declare the
// same builder methods with other types.
const pluginPrisma = fileURLToPath(new URL('../../plugin-prisma/src/index.ts', import.meta.url));

describe('loading @pothos/plugin-prisma in the same program', () => {
  it('fails to build a schema with plugin-prisma-next', async () => {
    vi.resetModules();
    const { default: SchemaBuilder } = await import('@pothos/core');
    const { default: prismaNextPlugin } = await import('../src');
    await import(pluginPrisma);
    const builder = new SchemaBuilder({ plugins: [prismaNextPlugin] } as never);
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    expect(() => builder.toSchema()).toThrow('cannot be used in the same program');
  });
});
