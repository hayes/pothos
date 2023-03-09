import { rateLimitDirective } from 'graphql-rate-limit-directive';
import builder from '../builder';

const myInput = builder.inputType('MyInput', {
  fields: (t) => ({
    id: t.id({ required: true }),
    idWithDefault: t.id({ required: false, defaultValue: '123' }),
    booleanWithDefault: t.boolean({ required: false, defaultValue: false }),
    enumWithDefault: t.field({
      defaultValue: 2,
      type: myEnum,
    }),
    stringWithDefault: t.string({ required: false, defaultValue: 'default string' }),
    ids: t.idList({ required: true }),
    idsWithDefault: t.idList({ required: false, defaultValue: ['123', '456'] }),
  }),
});

const myOtherInput = builder.inputType('MyOtherInput', {
  fields: (t) => ({
    booleanWithDefault: t.boolean({ required: false, defaultValue: false }),
  }),
});

const myEnum = builder.enumType('EN', {
  directives: {
    e: { foo: 123 },
  },
  values: {
    ONE: {
      value: 1,
      directives: {
        ev: { foo: 123 },
      },
    },
    TWO: {
      value: 2,
    },
  },
});

builder.queryType({
  directives: {
    o: {
      foo: 123,
    },
    rateLimit: {
      limit: 1,
      duration: 5,
    },
  },
  fields: (t) => ({
    test: t.string({
      directives: [
        {
          name: 'f',
          args: {
            foo: 123,
          },
        },
      ],
      args: {
        arg1: t.arg.string({
          directives: {
            a: { foo: 123 },
          },
        }),
        myOtherInput: t.arg({ type: myOtherInput, required: false, defaultValue: {} }),
        myInput: t.arg({ type: myInput, required: false }),
      },
      resolve: () => 'hi',
    }),
  }),
});

const Obj = builder.objectRef<{}>('Obj').implement({
  directives: {
    o: { foo: 123 },
  },
  fields: (t) => ({
    field: t.string({
      resolve: () => 'hi',
    }),
  }),
});

builder.interfaceRef<{}>('IF').implement({
  directives: {
    i: { foo: 123 },
  },
  fields: (t) => ({
    field: t.string(),
  }),
});

builder.inputRef<{}>('In').implement({
  directives: {
    io: { foo: 123 },
  },
  fields: (t) => ({
    test: t.string({
      directives: { if: { foo: 123 } },
    }),
  }),
});

builder.unionType('UN', {
  directives: {
    u: { foo: 123 },
  },
  resolveType: () => {
    throw new Error('Not implemented');
  },
  types: [Obj],
});

builder.scalarType('Date', {
  directives: {
    s: { foo: 123 },
  },
  serialize: () => new Date(),
});

const { rateLimitDirectiveTransformer } = rateLimitDirective();
const schema = rateLimitDirectiveTransformer(builder.toSchema());

export default schema;
