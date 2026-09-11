import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';

const builder = new SchemaBuilder({ plugins: [ErrorsPlugin] });
// #region error
class NameTooShort extends Error {
  minimum = 3;
  constructor() {
    super('Use at least three characters');
  }
}
builder.objectType(NameTooShort, {
  name: 'NameTooShort',
  fields: (t) => ({ message: t.exposeString('message'), minimum: t.exposeInt('minimum') }),
});
// #endregion error
// #region field
builder.queryType({
  fields: (t) => ({
    greeting: t.string({
      args: { name: t.arg.string({ required: true }), simulateFailure: t.arg.boolean() },
      errors: { types: [NameTooShort] },
      resolve: (_, { name, simulateFailure }) => {
        if (simulateFailure) {
          throw new Error('Service unavailable');
        }
        if (name.length < 3) {
          throw new NameTooShort();
        }
        return `Hello, ${name}`;
      },
    }),
  }),
});
// #endregion field
export const schema = builder.toSchema();
