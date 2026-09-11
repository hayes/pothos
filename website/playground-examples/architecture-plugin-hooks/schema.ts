import SchemaBuilder from '@pothos/core';
import { pluginName } from './plugin';

const builder = new SchemaBuilder({
  plugins: [pluginName],
  optionInRootOfConfig: true,
  nestedOptionsObject: { exampleOption: 'Configured object' },
});
const User = builder.objectRef<{ name: string }>('User').implement({
  optionOnObject: true,
  fields: (t) => ({
    name: t.exposeString('name'),
    removeMe: t.string({ resolve: () => 'Hidden' }),
  }),
});
const Choice = builder.enumType('Choice', {
  values: { KEEP: { value: 'keep' }, REMOVE: { value: 'removeMe' } },
});
const Input = builder.inputType('ExampleInput', {
  fields: (t) => ({ keep: t.string(), removeMe: t.string() }),
});
const Custom = builder.buildCustomObject();
const custom: { custom: 'shape' } = { custom: 'shape' };
builder.queryType({
  fields: (t) => ({
    user: t.field({ type: User, resolve: () => ({ name: 'Alex' }) }),
    custom: t.field({ type: Custom, resolve: () => custom }),
    choice: t.field({ type: Choice, resolve: (): 'keep' => 'keep' }),
  }),
});
builder.mutationType({
  fields: (t) => ({
    update: t.boolean({
      customMutationFieldOption: true,
      args: { input: t.arg({ type: Input }) },
      resolve: () => true,
    }),
  }),
});
// Build twice: runUnique runs the preparation callback only once.
builder.toSchema({ customBuildTimeOptions: false });
export const schema = builder.toSchema({ customBuildTimeOptions: true });
