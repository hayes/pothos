// #region helper
import type { ObjectRef } from '@pothos/core';
import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

type BuilderTypes = typeof builder.$inferSchemaTypes;

function addCommonFields(refs: ObjectRef<BuilderTypes, unknown, { id: string }>[]) {
  for (const ref of refs) {
    builder.objectFields(ref, (t) => ({
      id: t.exposeID('id', {}),
      idLength: t.int({
        resolve: (parent) => parent.id.length,
      }),
    }));
  }
}

const WithCommonFields1 = builder.objectRef<{ id: string }>('WithCommonFields1').implement({});
const WithCommonFields2 = builder.objectRef<{ id: string }>('WithCommonFields2').implement({});

addCommonFields([WithCommonFields1, WithCommonFields2]);
// #endregion helper

builder.queryType({
  fields: (t) => ({
    first: t.field({ type: WithCommonFields1, resolve: () => ({ id: 'abc' }) }),
    second: t.field({ type: WithCommonFields2, resolve: () => ({ id: 'abcdef' }) }),
  }),
});

export const schema = builder.toSchema();
