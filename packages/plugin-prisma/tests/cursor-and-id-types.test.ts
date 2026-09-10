import { describe, expect, it } from 'vitest';
import {
  formatPrismaCursor,
  getDefaultIDParser,
  getDefaultIDSerializer,
  parsePrismaCursor,
} from '../src/util/cursors';
import type { DMMF, DMMFField } from '../src/util/get-client';

// The fixture schema has no float column, and every id it declares is an Int or a String, so the
// scalar types below can only be exercised against a datamodel written here. `getModel` reads
// `prisma.dmmf` when the builder carries one, which is all these helpers need.
function builderFor(
  fields: Partial<DMMFField>[],
  primaryKey: DMMF['datamodel']['models'][number]['primaryKey'] = null,
) {
  const dmmf = {
    datamodel: {
      models: [
        {
          name: 'Model',
          fields: fields.map((field) => ({
            kind: 'scalar',
            isRequired: true,
            isList: false,
            hasDefaultValue: false,
            isUnique: false,
            isId: false,
            ...field,
          })) as DMMFField[],
          primaryKey,
          uniqueIndexes: [],
        },
      ],
    },
  };

  return { options: { prisma: { dmmf } } } as unknown as PothosSchemaTypes.SchemaBuilder<never>;
}

describe('cursors', () => {
  it('round trips a value from a float column', () => {
    expect(parsePrismaCursor(formatPrismaCursor({ views: 1.75 }, 'views'))).toBe(1.75);
  });

  it('round trips a number too large to write in full', () => {
    expect(parsePrismaCursor(formatPrismaCursor({ n: 1e21 }, 'n'))).toBe(1e21);
  });

  it('round trips an integer and a negative number', () => {
    expect(parsePrismaCursor(formatPrismaCursor({ n: 42 }, 'n'))).toBe(42);
    expect(parsePrismaCursor(formatPrismaCursor({ n: -5 }, 'n'))).toBe(-5);
  });
});

describe('node ids', () => {
  it('round trips a DateTime id with its milliseconds', () => {
    const builder = builderFor([{ name: 'at', type: 'DateTime', isId: true }]);
    const at = new Date(1_700_000_000_123);

    const id = getDefaultIDSerializer('Model', 'at', builder)({ at }) as string;

    expect(getDefaultIDParser('Model', 'at', builder)(id)).toEqual(at);
  });

  it('reads a DateTime id written before it was serialized as ISO', () => {
    const builder = builderFor([{ name: 'at', type: 'DateTime', isId: true }]);
    const at = new Date(1_700_000_000_000);

    expect(getDefaultIDParser('Model', 'at', builder)(String(at))).toEqual(at);
  });

  it('round trips a Bytes id', () => {
    const builder = builderFor([{ name: 'key', type: 'Bytes', isId: true }]);
    const key = new Uint8Array([1, 2, 250]);

    const id = getDefaultIDSerializer('Model', 'key', builder)({ key }) as string;

    expect(getDefaultIDParser('Model', 'key', builder)(id)).toEqual(Buffer.from(key));
  });

  it('round trips a compound id whose parts are not strings', () => {
    const builder = builderFor(
      [
        { name: 'key', type: 'Bytes' },
        { name: 'meta', type: 'Json' },
        { name: 'n', type: 'Int' },
      ],
      { name: null, fields: ['key', 'meta', 'n'] },
    );
    const key = new Uint8Array([1, 2, 250]);

    const id = getDefaultIDSerializer(
      'Model',
      'key_meta_n',
      builder,
    )({
      key,
      meta: { a: 1 },
      n: 3,
    }) as string;

    expect(getDefaultIDParser('Model', 'key_meta_n', builder)(id)).toEqual({
      key: Buffer.from(key),
      meta: { a: 1 },
      n: 3,
    });
  });
});
