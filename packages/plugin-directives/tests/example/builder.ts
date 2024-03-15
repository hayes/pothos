import SchemaBuilder from '@pothos/core';
import DirectivePlugin from '../../src';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type DirectiveTypes = {
  rateLimit: {
    locations: 'FIELD_DEFINITION' | 'OBJECT';
    args: {
      limit: number;
      duration: number;
    };
  };
  s: {
    locations: 'SCALAR';
    args: { foo: number };
  };
  o: {
    locations: 'OBJECT';
    args: { foo: number };
  };
  f: {
    locations: 'FIELD_DEFINITION';
    args: { foo: number };
  };
  a: {
    locations: 'ARGUMENT_DEFINITION';
    args: { foo: number };
  };
  i: {
    locations: 'INTERFACE';
    args: { foo: number };
  };
  u: {
    locations: 'UNION';
    args: { foo: number };
  };
  e: {
    locations: 'ENUM';
    args: { foo: number };
  };
  ev: {
    locations: 'ENUM_VALUE';
    args: { foo: number };
  };
  io: {
    locations: 'INPUT_OBJECT';
    args: { foo: number };
  };
  if: {
    locations: 'INPUT_FIELD_DEFINITION';
    args: { foo: number };
  };
};

const builder = new SchemaBuilder<{
  Directives: DirectiveTypes;
  Scalars: {
    Date: { Input: Date; Output: Date };
  };
}>({
  plugins: [DirectivePlugin],
  directives: {
    useGraphQLToolsUnorderedDirectives: true,
  },
});

export default builder;
