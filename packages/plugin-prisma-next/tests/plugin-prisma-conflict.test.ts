import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Imported through a variable so tsc doesn't load plugin-prisma's global types, which declare the
// same builder methods with other types.
const pluginPrisma = fileURLToPath(new URL('../../plugin-prisma/src/index.ts', import.meta.url));
const conflict = 'cannot be used in the same program';

describe('loading @pothos/plugin-prisma in the same program', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('fails to import plugin-prisma after plugin-prisma-next', async () => {
    const { default: SchemaBuilder } = await import('@pothos/core');
    await import('../src');
    const prismaObject = SchemaBuilder.prototype.prismaObject;
    await expect(import(pluginPrisma)).rejects.toThrow(conflict);
    expect(SchemaBuilder.prototype.prismaObject).toBe(prismaObject);
  });

  it('fails to import plugin-prisma-next after plugin-prisma', async () => {
    await import(pluginPrisma);
    await expect(import('../src')).rejects.toThrow(conflict);
  });
});
