import SchemaBuilder from '../src';

interface Thing {
  id: string;
}

describe('interface name overrides', () => {
  it('uses the name from options when implementing an interface ref', () => {
    const builder = new SchemaBuilder({});
    const ref = builder.interfaceRef<Thing>('Internal');

    builder.interfaceType(ref, {
      name: 'Public',
      fields: (t) => ({
        id: t.id({ resolve: (parent) => parent.id, exampleRequiredOptionFromPlugin: true }),
      }),
    });

    builder.objectRef<Thing>('Thing').implement({
      interfaces: [ref],
      isTypeOf: () => true,
      fields: (t) => ({ id: t.id({ resolve: (parent) => parent.id }) }),
    });

    builder.queryType({
      fields: (t) => ({
        thing: t.field({ type: ref, resolve: () => ({ id: '1' }) }),
      }),
    });

    const schema = builder.toSchema();

    expect(schema.getType('Public')).toBeDefined();
    expect(schema.getType('Internal')).toBeUndefined();
    expect(ref.name).toBe('Public');
  });

  it('renames an object ref implemented with a name option', () => {
    const builder = new SchemaBuilder({});
    const ref = builder.objectRef<Thing>('Internal');

    builder.objectType(ref, {
      name: 'Public',
      fields: (t) => ({ id: t.id({ resolve: (parent) => parent.id }) }),
    });

    builder.queryType({
      fields: (t) => ({ thing: t.field({ type: ref, resolve: () => ({ id: '1' }) }) }),
    });

    expect(builder.toSchema().getType('Public')).toBeDefined();
    expect(ref.name).toBe('Public');
  });

  it('uses the name from options when calling ref.implement', () => {
    const builder = new SchemaBuilder({});
    const ref = builder.interfaceRef<Thing>('Internal');

    ref.implement({
      name: 'Public',
      fields: (t) => ({
        id: t.id({ resolve: (parent) => parent.id, exampleRequiredOptionFromPlugin: true }),
      }),
    });

    builder.objectRef<Thing>('Thing').implement({
      interfaces: [ref],
      isTypeOf: () => true,
      fields: (t) => ({ id: t.id({ resolve: (parent) => parent.id }) }),
    });

    builder.queryType({
      fields: (t) => ({
        thing: t.field({ type: ref, resolve: () => ({ id: '1' }) }),
      }),
    });

    const schema = builder.toSchema();

    expect(schema.getType('Public')).toBeDefined();
    expect(schema.getType('Internal')).toBeUndefined();
  });
});
