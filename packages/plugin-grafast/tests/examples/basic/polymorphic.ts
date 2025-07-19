import { get, inhibitOnNull, loadOne, type Step } from 'grafast';
import { builder } from './builder';

interface AnimalData {
  id: string;
  kind: 'Dog' | 'Cat';
}

export const Animals = [
  {
    id: '1',
    kind: 'Dog',
  },
  {
    id: '2',
    kind: 'Cat',
  },
] satisfies AnimalData[];

function getAnimalsById(ids: readonly string[]): (AnimalData | null)[] {
  return ids.map((id) => Animals.find((entity) => entity.id === id) ?? null);
}

export const Animal = builder
  .interfaceRef<AnimalData>('Animal')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id'),
    }),
  })
  .withPlan(($record) => {
    return {
      $__typename: get($record, 'kind'),
    };
  });
export const Dog = builder.objectRef<AnimalData>('Dog').implement({
  interfaces: [Animal],
});
export const Cat = builder.objectRef<AnimalData>('Cat').implement({
  interfaces: [Animal],
});

interface AlienData {
  id: string;
  kind: 'Alien';
}

const Aliens = [
  {
    id: '3',
    kind: 'Alien',
  },
] satisfies AlienData[];

function getEntitiesById(ids: readonly string[]): (AnimalData | AlienData | null)[] {
  return ids.map((id) => {
    const animal = Animals.find((entity) => entity.id === id);
    const alien = Aliens.find((entity) => entity.id === id);
    return animal ?? alien ?? null;
  });
}

export const Alien = builder.objectRef<AlienData>('Alien').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

export const Entity = builder
  .unionType('Entity', {
    types: [Cat, Dog, Alien],
  })
  .withPlan(
    (
      // Provide an explicit type so that the query field only needs to return the ID
      $specifier: Step<string>,
    ) => {
      const $record = inhibitOnNull(loadOne($specifier, getEntitiesById));
      return {
        $__typename: get($record, 'kind'),
        planForType: () => $record,
      };
    },
  );

builder.queryFields((t) => ({
  animal: t.field({
    type: Animal,
    args: {
      id: t.arg.string({ required: true }),
    },
    plan: (_, $args) => loadOne($args.$id, getAnimalsById),
  }),
  entity: t.field({
    type: Entity,
    args: {
      id: t.arg.string({ required: true }),
    },
    plan: (_, $args) => $args.$id,
  }),
}));
