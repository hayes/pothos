import type { SchemaTypes } from '@pothos/core';
import { describe, expect, it } from 'vitest';
import { type ModelKey, PrismaObjectFieldBuilder, type Row } from '../src';
import { createBuilder, run, useSampleDb } from './fixtures/helpers';

declare global {
  export namespace PothosSchemaTypes {
    export interface PrismaObjectFieldBuilder<
      in out Types extends SchemaTypes,
      in out M extends ModelKey<Types>,
      Shape = unknown,
      in out ExposableShape = Row<Types, M>,
    > {
      /** Added by another plugin to the `t` of prisma type fields. */
      testModelKey: () => M;
    }
  }
}

PrismaObjectFieldBuilder.prototype.testModelKey = function testModelKey(this: {
  modelKey: string;
}) {
  return this.modelKey;
};

const db = useSampleDb();

describe('field builder extensions', () => {
  it('calls methods assigned on the exported constructor from `t`', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      fields: (t) => {
        const model = t.testModelKey();
        return { model: t.string({ resolve: () => model }) };
      },
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => db.orm.User.where({ id: 'u-bob' }),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { model } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ users: [{ model: 'User' }] });
  });
});
