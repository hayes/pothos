import { ArgBuilder, ObjectRef } from '../../../../src';
import { InputFieldBuilder } from '../../../../src/fieldUtils/input';
import builder, { TypesWithDefault } from '../builder';

type PothosTypes = typeof builder extends PothosSchemaTypes.SchemaBuilder<infer T> ? T : never;

function addCommonFields(refs: ObjectRef<PothosTypes, unknown, { id: string }>[]) {
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

function createCommonArgs(arg: ArgBuilder<TypesWithDefault>) {
  return {
    id: arg.id({}),
    reason: arg({ type: 'String', required: false }),
  };
}

function createInputFields(t: InputFieldBuilder<TypesWithDefault, 'InputObject'>) {
  return {
    id: t.id({}),
    reason: t.field({ type: 'String', required: false }),
  };
}

builder.mutationType({
  fields: (t) => ({
    mutation1: t.boolean({
      args: {
        ...createCommonArgs(t.arg),
      },
      resolve: (parent, args) => !!args.reason,
    }),
    mutation2: t.boolean({
      args: {
        ...createCommonArgs(t.arg),
      },
      resolve: (parent, args) => !!args.reason,
    }),
  }),
});

builder.inputType('InputWithCommonFields1', {
  fields: (t) => ({
    ...createInputFields(t),
  }),
});

builder.inputType('InputWithCommonFields2', {
  fields: (t) => ({
    ...createInputFields(t),
  }),
});
