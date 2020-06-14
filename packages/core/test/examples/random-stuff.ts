import { printSchema } from 'graphql';
import SchemaBuilder, { InputObjectRef, RecursivelyNormalizeNullableFields } from '../../src';

// Define backing models/types
type Types = {
  Object: {
    User: { firstName: string; lastName: string };
    Article: { title: string; body: string };
    Sheep: { name: string; count: number; shaved: boolean };
  };
  Interface: {
    Countable: { count: number };
    Shaveable: { shaved: boolean };
  };
  Scalar: {
    String: { Input: string; Output: string };
    ID: { Input: string; Output: string | number };
    Int: { Input: number; Output: number };
    Float: { Input: number; Output: number };
    Boolean: { Input: boolean; Output: boolean };
  };
  Context: { userID: number };
};

const builder = new SchemaBuilder<Types>({});

// Create input types
const Example = builder.inputType('Example', {
  shape: (t) => ({
    id: t.id({ required: true }),
    id2: t.int({ required: false }),
    ids: t.idList({ required: true }),
    ids2: t.intList({ required: false }),
  }),
});

interface ExampleShape {
  example: {
    id: string;
    id2?: number;
    ids: string[];
    ids2?: number[];
  };
  id?: string;
  ids: string[];
  more: ExampleShape;
}

const Example2: InputObjectRef<RecursivelyNormalizeNullableFields<
  ExampleShape
>> = builder.inputType('Example2', {
  shape: (t) => ({
    example: t.type({ type: Example, required: true }),
    id: t.id({ required: false }),
    ids: t.idList({ required: true }),
    more: t.type({ type: Example2, required: true }),
  }),
});

// Union type
const SearchResult = builder.unionType('SearchResult', {
  members: ['User', 'Article'],
  resolveType: (parent) => {
    return Object.prototype.hasOwnProperty.call(parent, 'firstName') ? 'User' : 'Article';
  },
});

// Creating an ObjectType and its resolvers
builder.objectType('User', {
  shape: (t) => ({
    // add a scalar field
    id: t.id({ resolve: () => 5 }),
    // parent is inferred from model shapes defined in builder
    displayName: t.field({
      type: 'String',
      resolve: ({ firstName, lastName }) => `${firstName} ${lastName.slice(0, 1)}.`,
    }),
    // can omit resolvers by exposing fields from the backing model
    firstName: t.exposeString('firstName', {}),
    lastName: t.exposeString('lastName', {}),
    // Non scalar fields:
    firstBornChild: t.field({
      type: 'User',
      resolve: () => ({
        firstName: 'child',
        lastName: '1',
      }),
    }),
    // creating a resolver with args
    partialName: t.string({
      args: {
        example: t.arg.type({ type: Example, required: true }),
        firstN: t.arg.int({ required: true }),
      },
      resolve: (parent, args) => {
        return parent.firstName.slice(0, args.firstN) + args.example.id;
      },
    }),
    // creating a resolver with args that use recursive types
    recursiveArgs: t.id({
      args: {
        example2: t.arg.type({ type: Example2, required: true }),
        firstN: t.arg.id({}),
      },
      resolve: (parent, args) => {
        return Number.parseInt(args.example2.more.more.more.example.id, 10);
      },
    }),
    // Using a union type
    related: t.field({
      resolve: (parent) => {
        return {
          body: 'stuff',
          title: 'hi',
        };
      },
      // reference implementation so we can automatically pull types for all member types
      type: SearchResult,
    }),
    // Lists
    friends: t.field({
      resolve: (parent) => {
        return [parent];
      },
      type: ['User'],
    }),
    // list helpers
    stuff: t.stringList({
      resolve() {
        return ['soup', 'cats'];
      },
    }),
    // optional fields
    optional: t.string({
      nullable: true,
      resolve: () => null,
    }),
    // list and optional args
    list: t.idList({
      args: {
        ids: t.arg.idList({ required: true }),
      },
      resolve: (parent, args) => (args.ids || []).map((n) => Number.parseInt(n, 10)),
    }),
    sparseList: t.idList({
      args: {
        ids: t.arg.idList({
          required: {
            list: true,
            items: false,
          },
        }),
      },
      nullable: {
        list: false,
        items: true,
      },
      resolve: (parent, args) => args.ids,
    }),
    notSparseList: t.idList({
      args: {
        ids: t.arg.idList({
          required: {
            list: true,
            items: true,
          },
        }),
      },
      nullable: {
        list: true,
        items: false,
      },
      resolve: (parent, args) => args.ids,
    }),
    defaultArgs: t.idList({
      args: {
        ids: t.arg.idList({
          required: { items: true, list: true },
          defaultValue: ['abc'],
        }),
      },
      resolve: (parent, args) => [123, ...args.ids],
    }),
  }),
});

builder.objectFields('User', (t) => ({
  newField: t.string({ resolve: () => 'hii' }),
}));

builder.interfaceType('Countable', {
  shape: (t) => ({
    count: t.int({
      args: {
        max: t.arg.int({ required: true }),
      },
      resolve: (parent, args) => Math.min(args.max, parent.count),
    }),
  }),
});

const Shaveable = builder.interfaceType('Shaveable', {
  shape: (t) => ({
    id: t.id({
      resolve: () => 5,
    }),
    shaved: t.exposeBoolean('shaved', {}),
    extendMePlease: t.string({}),
  }),
});

// Enums
const Stuff = builder.enumType('stuff', {
  values: ['Beats', 'Bears', 'BattlestarGalactica'] as const,
});

builder.objectType('Sheep', {
  implements: [Shaveable, 'Countable'],
  // used in dynamic resolveType method for Shaveable and Countable interfaces
  // probably needs a different name, but when true, the interfaces resolveType will return
  isType: () => true,
  shape: (t) => ({
    color: t.string({
      args: {
        id: t.arg.id({}),
      },
      resolve: (p, { id }) => (id === '1' ? 'black' : 'white'),
    }),
    thing: t.field({
      type: Stuff,
      resolve: () => 'Bears' as const,
    }),
  }),
});

builder.queryType({
  shape: (t) => ({
    user: t.field({
      resolve: () => ({
        firstName: 'user',
        lastName: 'name',
      }),
      type: 'User',
    }),
    stuff: t.field({
      type: [Stuff],
      resolve() {
        return ['Bears', 'Beats', 'BattlestarGalactica'] as const;
      },
    }),
    sheep: t.field({
      type: 'Sheep',
      resolve: () => ({
        count: 5,
        name: 'bah-bah',
        shaved: true,
      }),
    }),
  }),
});

builder.objectType(
  'Article',
  {
    description: 'shape can be last arg',
  },
  (t) => ({
    title: t.string({
      description: 'Title of the article, probably click bait',
      resolve: () => 'Things are happening!',
    }),
  }),
);

builder.subscriptionType({
  shape: (t) => ({
    event: t.field({
      type: 'String',
      subscribe: () => {
        return (async function* subscribe() {
          yield await Promise.resolve('123');
        })();
      },
      resolve: (parent) => parent.toLocaleLowerCase(),
    }),
  }),
});

const schema = builder.toSchema();

export default schema;
