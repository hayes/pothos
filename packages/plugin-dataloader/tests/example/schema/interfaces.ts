import builder from '../builder';
import { ContextType } from '../types';
import { animalCounts, countCall } from './counts';

export const TestInterface = builder.interfaceRef<{ id: number }>('TestInterface').implement({
  fields: (t) => ({
    idFromInterface: t.exposeID('id', {}),
  }),
});

export interface Dog {
  type: 'Dog';
  chasingTail: boolean;
}

export interface Cat {
  type: 'Cat';
  chasingMouse: boolean;
}

const Animal = builder.loadableInterface('Animal', {
  load: (ids: number[], ctx: ContextType) => {
    countCall(ctx, animalCounts, ids.length);

    return Promise.resolve<(Cat | Dog)[]>(
      ids.map((id) =>
        id % 2
          ? { type: 'Cat', chasingMouse: !((id % 4) % 2) }
          : { type: 'Dog', chasingTail: !((id % 4) % 2) },
      ),
    );
  },
  fields: (t) => ({
    type: t.exposeString('type'),
  }),
});

export const DogObject = builder.objectRef<Dog>('Dog').implement({
  interfaces: [Animal],
  isTypeOf: (animal) => animal.type === 'Dog',
  fields: (t) => ({
    chasingTail: t.exposeBoolean('chasingTail'),
  }),
});

export const CatObject = builder.objectRef<Cat>('Cat').implement({
  interfaces: [Animal],
  isTypeOf: (animal) => animal.type === 'Cat',
  fields: (t) => ({
    chasingMouse: t.exposeBoolean('chasingMouse'),
  }),
});

builder.queryField('animals', (t) =>
  t.field({
    type: [Animal],
    args: {
      ids: t.arg.idList({
        required: true,
      }),
    },
    resolve: (root, args) => args.ids.map((id) => Number.parseInt(String(id), 10)),
  }),
);
