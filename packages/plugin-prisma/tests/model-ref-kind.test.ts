import SchemaBuilder from '@pothos/core';
import PrismaPlugin, { getRefFromModel, type PrismaTypesFromClient } from '../src';
import { prisma } from './example/builder';
import { getDatamodel } from './generated.js';

// The model ref cache is keyed by model name alone, so the kind the first caller asked for is the
// kind every later caller gets. Asking for the other kind used to hand back the wrong ref typed
// as the one that was asked for.
function createBuilder() {
  return new SchemaBuilder<{
    PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  }>({
    plugins: [PrismaPlugin],
    prisma: {
      client: () => prisma,
      dmmf: getDatamodel(),
    },
  });
}

const mismatch =
  "Prisma model User was created as both an object and interface.  Use 'variant' instead of 'name' in one of the implementations";

describe('model ref kinds', () => {
  it('throws when an interface is asked for after an object', () => {
    const builder = createBuilder();

    builder.prismaObject('User', {
      fields: (t) => ({ id: t.exposeID('id') }),
    });

    expect(() =>
      builder.prismaInterface('User', {
        resolveType: () => 'User',
        fields: (t) => ({ id: t.exposeID('id') }),
      }),
    ).toThrow(mismatch);
  });

  it('throws when an object is asked for after an interface', () => {
    const builder = createBuilder();

    builder.prismaInterface('User', {
      resolveType: () => 'User',
      fields: (t) => ({ id: t.exposeID('id') }),
    });

    expect(() =>
      builder.prismaObject('User', {
        fields: (t) => ({ id: t.exposeID('id') }),
      }),
    ).toThrow(mismatch);
  });

  it('names the interface from `prismaInterfaceFields`, not an object', () => {
    const builder = createBuilder();

    // A model name handed to `prismaInterfaceFields` names the interface registered under it, so
    // registering that interface afterwards is not a mismatch.
    builder.prismaInterfaceFields('User', (t) => ({ id: t.exposeID('id') }));

    expect(() =>
      builder.prismaInterface('User', {
        resolveType: () => 'User',
        fields: (t) => ({ name: t.exposeString('name', { nullable: true }) }),
      }),
    ).not.toThrow();
  });

  it('looks up an existing interface through root and relation model names', () => {
    const builder = createBuilder();
    const User = builder.prismaInterface('User', {
      resolveType: () => 'ConcreteUser',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('User', {
      variant: 'ConcreteUser',
      interfaces: [User],
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('Post', {
      fields: (t) => ({ author: t.relation('author') }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: 'User',
          nullable: true,
          resolve: () => null,
        }),
      }),
    });

    expect(getRefFromModel('User', builder)).toBe(User);
    expect(() => builder.toSchema()).not.toThrow();
  });

  it('keeps handing back the same ref for repeated calls of one kind', () => {
    const builder = createBuilder();

    expect(getRefFromModel('User', builder)).toBe(getRefFromModel('User', builder));
    expect(getRefFromModel('Post', builder, 'interface')).toBe(
      getRefFromModel('Post', builder, 'interface'),
    );
  });
});
