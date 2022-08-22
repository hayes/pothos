import builder from '../builder';
import Character from './character';

const FunctionFilter = builder.inputType('FunctionFilter', {
  subGraphs: ['Private', 'Public'],
  fields: (t) => ({
    public: t.boolean({
      required: false,
      subGraphs: ['Public'],
    }),
    private: t.boolean({
      required: false,
      subGraphs: ['Private'],
    }),
  }),
});

export default builder.objectType('Droid', {
  subGraphs: ['Private', 'Public'],
  description: 'A mechanical creature in the Star Wars universe.',
  interfaces: [Character],
  isTypeOf: (item) => (item as { type: string }).type === 'Droid',
  fields: (t) => ({
    primaryFunction: t.string({
      description: 'The primary function of the droid.',
      args: {
        language: t.arg.string({
          subGraphs: ['Private'],
          description: 'The language to use for localization.',
        }),
        filter: t.arg({ type: FunctionFilter }),
      },
      resolve: (o) => o.primaryFunc || 'N/A',
    }),
  }),
});
