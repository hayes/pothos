import SchemaBuilder, {
  BasePlugin,
  type InputFieldsMapping,
  type InputTypeFieldsMapping,
  mapInputFields,
  type PothosInputFieldConfig,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '../src';

const pluginName = 'inputMappingCacheTestPlugin' as keyof PothosSchemaTypes.Plugins<SchemaTypes>;

type Mapping = InputFieldsMapping<SchemaTypes, string> | null;

interface Recorded {
  shared: Mapping;
  fresh: Mapping;
}

let recorded: Record<string, Recorded> = {};
let mapperCalls: string[] = [];

function mapper(field: PothosInputFieldConfig<SchemaTypes>) {
  mapperCalls.push(`${field.parentType}.${field.name}`);

  return field.name === 'leaf' || field.name === 'marked' ? field.name : null;
}

class RecordMappingsPlugin extends BasePlugin<SchemaTypes> {
  private mappingCache = new Map<string, InputTypeFieldsMapping<SchemaTypes, string>>();

  override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<SchemaTypes>) {
    if (Object.keys(fieldConfig.args).length > 0) {
      recorded[fieldConfig.name] = {
        shared: mapInputFields(fieldConfig.args, this.buildCache, mapper, this.mappingCache),
        // Same mapping without a cache, and without counting mapper calls
        fresh: mapInputFields(fieldConfig.args, this.buildCache, (field) =>
          field.name === 'leaf' || field.name === 'marked' ? field.name : null,
        ),
      };
    }

    return fieldConfig;
  }
}

SchemaBuilder.registerPlugin(pluginName, RecordMappingsPlugin as never);

// Reduce a mapping to plain data, cutting cycles, so shared and fresh results can be compared
function describeMapping(map: Mapping, seen = new Set<unknown>()): unknown {
  if (!map) {
    return null;
  }

  if (seen.has(map)) {
    return '[cycle]';
  }

  const nextSeen = new Set(seen).add(map);

  return Object.fromEntries(
    [...map.entries()].map(([name, mapping]) => [
      name,
      mapping.kind === 'InputObject'
        ? {
            value: mapping.value,
            listDepth: mapping.listDepth,
            fields: describeMapping(mapping.fields.map, nextSeen),
          }
        : { value: mapping.value, listDepth: mapping.listDepth },
    ]),
  );
}

function buildSchema() {
  recorded = {};
  mapperCalls = [];

  const builder = new SchemaBuilder({ plugins: [pluginName] });

  // A <-> B cycle with a mapped leaf on A
  const A = builder.inputRef<object>('A');
  const B = builder.inputRef<object>('B');
  // C <-> D cycle with nothing mapped
  const C = builder.inputRef<object>('C');
  const D = builder.inputRef<object>('D');
  // `marked` is mapped itself but its type has no mapped fields
  const Marked = builder.inputType('Marked', {
    fields: (t) => ({ plain: t.string() }),
  });
  const Wrapper = builder.inputType('Wrapper', {
    fields: (t) => ({
      marked: t.field({ type: Marked }),
      unmappedList: t.field({ type: [[Marked]] }),
      c: t.field({ type: C }),
    }),
  });

  A.implement({ fields: (t) => ({ b: t.field({ type: B }), leaf: t.string() }) });
  B.implement({ fields: (t) => ({ a: t.field({ type: [A] }) }) });
  C.implement({ fields: (t) => ({ d: t.field({ type: D }), plain: t.string() }) });
  D.implement({ fields: (t) => ({ c: t.field({ type: C }) }) });

  builder.queryType({
    fields: (t) => ({
      // B is first reached through the cycle, then directly by later fields
      viaA: t.string({ args: { a: t.arg({ type: A }) }, resolve: () => '' }),
      viaB: t.string({ args: { b: t.arg({ type: B }) }, resolve: () => '' }),
      viaBList: t.string({ args: { b: t.arg({ type: [B] }) }, resolve: () => '' }),
      unmapped: t.string({ args: { c: t.arg({ type: C }) }, resolve: () => '' }),
      unmappedAgain: t.string({ args: { d: t.arg({ type: [D] }) }, resolve: () => '' }),
      wrapper1: t.string({ args: { w: t.arg({ type: Wrapper }) }, resolve: () => '' }),
      wrapper2: t.string({ args: { w: t.arg({ type: Wrapper }) }, resolve: () => '' }),
      marked1: t.string({ args: { marked: t.arg({ type: Marked }) }, resolve: () => '' }),
      marked2: t.string({ args: { marked: t.arg({ type: Marked }) }, resolve: () => '' }),
    }),
  });

  builder.toSchema();
}

describe('mapInputFields with a shared cache', () => {
  beforeAll(() => {
    buildSchema();
  });

  it('returns the same mappings as an uncached call for every field', () => {
    expect(Object.keys(recorded)).toHaveLength(9);

    for (const [field, { shared, fresh }] of Object.entries(recorded)) {
      expect({ field, mapping: describeMapping(shared) }).toEqual({
        field,
        mapping: describeMapping(fresh),
      });
    }
  });

  it('resolves mappings reached through a cycle', () => {
    expect(describeMapping(recorded.viaB.shared)).toEqual({
      b: {
        value: null,
        listDepth: 0,
        fields: {
          a: {
            value: null,
            listDepth: 1,
            fields: {
              b: { value: null, listDepth: 0, fields: '[cycle]' },
              leaf: { value: 'leaf', listDepth: 0 },
            },
          },
        },
      },
    });
  });

  it('returns null for unmapped types, including cycles, on every call', () => {
    expect(recorded.unmapped.shared).toBeNull();
    expect(recorded.unmappedAgain.shared).toBeNull();
  });

  it('keeps fields.map null for a mapped field whose type has no mappings on repeat calls', () => {
    for (const name of ['wrapper1', 'wrapper2'] as const) {
      const w = recorded[name].shared?.get('w');
      const wrapperFields = w?.kind === 'InputObject' ? w.fields.map : null;
      const marked = wrapperFields?.get('marked');

      expect([...(wrapperFields?.keys() ?? [])]).toEqual(['marked']);
      expect(marked?.value).toBe('marked');
      expect(marked?.kind === 'InputObject' && marked.fields.map).toBeNull();
    }

    for (const name of ['marked1', 'marked2'] as const) {
      const marked = recorded[name].shared?.get('marked');

      expect(marked?.value).toBe('marked');
      expect(marked?.kind === 'InputObject' && marked.fields.map).toBeNull();
    }
  });

  it('maps the fields of each input type only once', () => {
    const typeFieldCalls = mapperCalls.filter((call) => !call.startsWith('Query.'));
    const counts = new Map<string, number>();

    for (const call of typeFieldCalls) {
      counts.set(call, (counts.get(call) ?? 0) + 1);
    }

    expect([...counts.values()].every((count) => count === 1)).toBe(true);
    expect([...counts.keys()].sort()).toEqual([
      'A.b',
      'A.leaf',
      'B.a',
      'C.d',
      'C.plain',
      'D.c',
      'Marked.plain',
      'Wrapper.c',
      'Wrapper.marked',
      'Wrapper.unmappedList',
    ]);
  });
});
