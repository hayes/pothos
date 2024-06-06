import './test-plugin/global-types';
import SchemaBuilder from '../../src';

// Define backing models/types
interface Types {
  Defaults: 'v4';
  Objects: {
    User: { firstName: string; lastName: string; funFact?: string | null };
    Article: { title: string; body: string };
    Sheep: { name: string; count: number; shaved: boolean };
  };
  Interfaces: {
    Countable: { count: number };
    Shaveable: { shaved: boolean };
  };
  Scalars: {
    Date: { Input: Date | string; Output: Date | string };
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    AnyJson: { Input: any | string; Output: unknown };
  };
  Context: { userID: number };
}

class Animal {
  species?: string;
}

class Giraffe extends Animal {
  override species = 'Giraffe' as const;

  name: string;

  age: number;

  constructor(name: string, age: number) {
    super();

    this.name = name;
    this.age = age;
  }
}

const builder = new SchemaBuilder<Types>({
  defaults: 'v4',
});

builder.scalarType('AnyJson', {
  serialize: (json) => json,
  parseValue: (value) => value,
});

builder.scalarType('Date', {
  serialize: (date) => new Date(date).toISOString(),
});

builder.interfaceType(Animal, {
  name: 'Animal',
  fields: (t) => ({
    species: t.exposeString('species', { nullable: true, exampleRequiredOptionFromPlugin: true }),
  }),
});

builder.objectType(Giraffe, {
  name: 'Giraffe',
  interfaces: [Animal],
  isTypeOf(parent) {
    return parent instanceof Animal && parent.species === 'Giraffe';
  },
  fields: (t) => ({
    name: t.exposeString('name', {}),
    age: t.exposeInt('age'),
    a: t.field({
      type: 'Boolean',
      resolve: (parent) => false,
    }),
  }),
});

enum MyEnum {
  Foo = 'foo',
  Bar = 'bar',
  Num = 5,
}

builder.enumType(MyEnum, {
  name: 'MyEnum',
  values: {
    Foo: {
      description: 'Some description here',
    },
    Num: {
      deprecationReason: 'Not used anymore..',
    },
  },
});

// Create input types
const Example = builder.inputType('Example', {
  fields: (t) => ({
    id: t.id({ required: true }),
    id2: t.int({ required: false }),
    ids: t.idList({ required: true }),
    ids2: t.intList({ required: false }),
    enum: t.field({ type: MyEnum }),
    date: t.field({
      type: 'Date',
    }),
    withNullDefault: t.field({
      type: 'Boolean',
      required: false,
      defaultValue: null,
    }),
  }),
});

interface ExampleShape {
  example: {
    id: string;
    id2?: number;
    ids: string[];
    ids2?: number[];
    enum?: MyEnum;
    date?: Date | string;
  };
  id?: string;
  ids: string[];
  more: ExampleShape;
  json?: any;
}

const Example2 = builder.inputRef<ExampleShape, false>('Example2');

Example2.implement({
  fields: (t) => ({
    example: t.field({ type: Example, required: true }),
    id: t.id({ required: false }),
    ids: t.idList({ required: true }),
    more: t.field({ type: Example2, required: true }),
  }),
});

export const Example3 = builder.inputRef<ExampleShape>('Example3').implement({
  fields: (t) => ({
    example: t.field({ type: Example, required: true }),
    id: t.id({ required: false }),
    ids: t.idList({ required: true }),
    more: t.field({ type: Example3, required: true }),
    json: t.field({ type: 'AnyJson', required: false }),
  }),
});

// Union type
const SearchResult = builder.unionType('SearchResult', {
  types: ['User', 'Article'],
  resolveType: (parent) => (Object.hasOwn(parent, 'firstName') ? 'User' : 'Article'),
});

// Creating an ObjectType and its resolvers
builder.objectType('User', {
  fields: (t) => ({
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
        example: t.arg({ type: Example, required: true }),
        firstN: t.arg.int({ required: true }),
      },
      resolve: (parent, args) => parent.firstName.slice(0, args.firstN) + String(args.example.id),
    }),
    // creating a resolver with args that use recursive types
    recursiveArgs: t.id({
      args: {
        example2: t.arg({ type: Example2, required: true }),
        firstN: t.arg.id(),
      },
      resolve: (parent, args) => Number.parseInt(args.example2.more.more.more.example.id, 10),
    }),
    // Using a union type
    related: t.field({
      resolve: (parent) => ({
        body: 'stuff',
        title: 'hi',
      }),
      // reference implementation so we can automatically pull types for all member types
      type: SearchResult,
    }),
    // Lists
    friends: t.field({
      resolve: (parent) => [parent],
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
    fact: t.exposeString('funFact', { nullable: true }),
  }),
});

builder.objectFields('User', (t) => ({
  newField: t.string({ resolve: () => 'hii' }),
}));

builder.interfaceType('Countable', {
  fields: (t) => ({
    count: t.int({
      exampleRequiredOptionFromPlugin: true,
      args: {
        max: t.arg.int({ required: true }),
      },
      resolve: (parent, args) => Math.min(args.max, parent.count),
    }),
  }),
});

const Shaveable = builder.interfaceType('Shaveable', {
  fields: (t) => ({
    id: t.id({
      exampleRequiredOptionFromPlugin: true,
      resolve: () => 5,
    }),
    shaved: t.exposeBoolean('shaved', {
      exampleRequiredOptionFromPlugin: true,
    }),
    extendMePlease: t.string({
      exampleRequiredOptionFromPlugin: true,
    }),
  }),
});

// Enums
const Stuff = builder.enumType('stuff', {
  values: ['Beats', 'Bears', 'BattlestarGalactica'],
});

builder.objectType('Sheep', {
  interfaces: [Shaveable, 'Countable'],
  // used in dynamic resolveType method for Shaveable and Countable interfaces
  // probably needs a different name, but when true, the interfaces resolveType will return
  isTypeOf: () => true,
  fields: (t) => ({
    color: t.string({
      args: {
        id: t.arg.id(),
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
  fields: (t) => ({
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
    comments: t.stringList({
      resolve: async function* resolve() {
        yield 'comment 1';

        yield await Promise.resolve('comment 2');

        return 'final comment';
      },
    }),
  }),
);

builder.subscriptionType({
  fields: (t) => ({
    event: t.field({
      type: 'String',
      subscribe: () =>
        (async function* subscribe() {
          yield await Promise.resolve('123');
        })(),
      resolve: (parent) => parent.toLocaleLowerCase(),
    }),
  }),
});

builder.queryField('constructor', (t) => t.boolean({ resolve: () => true }));

const NestedListInput = builder
  .inputRef<{ list: (number[] | null)[]; date?: Date | string }>('NestedListInput')
  .implement({
    fields: (t) => ({
      list: t.field({
        type: t.listRef(t.listRef('Int'), { required: false }),
        required: true,
      }),
      date: t.field({ type: 'Date', required: false }),
    }),
  });

builder.queryField('nestedLists', (t) =>
  t.field({
    type: t.listRef(t.listRef(t.listRef('String')), { nullable: true }),
    args: {
      input: t.arg({
        type: t.arg.listRef(t.arg.listRef(t.arg.listRef('String')), { required: false }),
        required: true,
      }),
      nestedListInput: t.arg({
        type: NestedListInput,
      }),
    },
    resolve: (_, args) => {
      const date: Date | string | null | undefined = args.nestedListInput?.date;
      void date;

      return args.input;
    },
  }),
);

builder
  .objectRef<{ bool?: boolean; bool2: boolean; boolList?: [boolean] }>('TestExposeNullable')
  .implement({
    fields: (t) => ({
      bool: t.exposeBoolean('bool', { nullable: true }),
      bList: t.exposeBooleanList('boolList', { nullable: { items: true, list: true } }),
      blist2: t.expose('boolList', { type: ['Boolean'], nullable: true }),
    }),
  });

builder
  .objectRef<{ list: readonly string[]; optionalList?: readonly string[] }>('TestExposeList')
  .implement({
    fields: (t) => ({
      list: t.exposeStringList('list', { nullable: false }),
      optionalList: t.exposeStringList('optionalList', { nullable: true }),
    }),
  });

const schema = builder.toSchema();

export default schema;
