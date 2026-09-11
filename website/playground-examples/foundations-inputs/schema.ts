// #region model
import SchemaBuilder from '@pothos/core';

type Giraffe = {
  name: string;
  birthdate: string;
  height: number;
};

const builder = new SchemaBuilder({});
const giraffes: Giraffe[] = [];

const GiraffeRef = builder.objectRef<Giraffe>('Giraffe').implement({
  fields: (t) => ({
    name: t.exposeString('name'),
    birthdate: t.exposeString('birthdate'),
    height: t.exposeFloat('height'),
  }),
});

builder.queryType({
  fields: (t) => ({
    giraffes: t.field({ type: [GiraffeRef], resolve: () => giraffes }),
  }),
});
// #endregion model

// #region input
const GiraffeInput = builder.inputType('GiraffeInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    birthdate: t.string({ required: true }),
    height: t.float({ required: true }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    createGiraffe: t.field({
      type: GiraffeRef,
      args: {
        input: t.arg({ type: GiraffeInput, required: true }),
      },
      resolve: (_root, { input }) => {
        giraffes.push(input);
        return input;
      },
    }),
  }),
});
// #endregion input

// #region recursive-input
interface RecursiveGiraffeInputShape {
  name: string;
  birthdate: string;
  height: number;
  friends?: RecursiveGiraffeInputShape[] | null;
}

const RecursiveGiraffeInput = builder.inputRef<RecursiveGiraffeInputShape>('RecursiveGiraffeInput');

RecursiveGiraffeInput.implement({
  fields: (t) => ({
    name: t.string({ required: true }),
    birthdate: t.string({ required: true }),
    height: t.float({ required: true }),
    friends: t.field({
      type: [RecursiveGiraffeInput],
      required: { list: false, items: true },
    }),
  }),
});

function createGiraffes(input: RecursiveGiraffeInputShape): Giraffe[] {
  const giraffe: Giraffe = {
    name: input.name,
    birthdate: input.birthdate,
    height: input.height,
  };

  return [giraffe, ...(input.friends ?? []).flatMap(createGiraffes)];
}

builder.mutationField('createGiraffeWithFriends', (t) =>
  t.field({
    type: [GiraffeRef],
    args: {
      input: t.arg({ type: RecursiveGiraffeInput, required: true }),
    },
    resolve: (_root, { input }) => {
      const created = createGiraffes(input);
      giraffes.push(...created);
      return created;
    },
  }),
);

export const schema = builder.toSchema();
// #endregion recursive-input
