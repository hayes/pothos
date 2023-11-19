import { execute, GraphQLScalarType } from 'graphql';
import {
  DateTimeResolver,
  NonNegativeIntResolver,
  HexColorCodeResolver,
} from 'graphql-scalars';
import gql from 'graphql-tag';
import SchemaBuilder from '../src';


const PositiveIntResolver = new GraphQLScalarType({
  name: 'PositiveInt',
  serialize: (n) => n as number,
  parseValue: (n) => {
    if (typeof n !== 'number') {
      throw new TypeError('Value must be a number');
    }

    if (n >= 0) {
      return n;
    }

    throw new TypeError('Value must be positive');
  },
});

enum Diet {
  HERBIVOROUS,
  CARNIVOROUS,
  OMNIVORIOUS,
}

class Animal {
  diet: Diet;

  constructor(diet: Diet) {
    this.diet = diet;
  }
}

class Kiwi extends Animal {
  name: string;
  birthday: Date;
  heightInMeters: number;

  constructor(name: string, birthday: Date, heightInMeters: number) {
    super(Diet.HERBIVOROUS);

    this.name = name;
    this.birthday = birthday;
    this.heightInMeters = heightInMeters;
  }
}

describe('scalars', () => {
  it('when a scalar is added withScalar, the scalartype is added', () => {
    const builder = new SchemaBuilder({}).withScalar('PositiveInt', PositiveIntResolver);
    builder.queryType();
    builder.queryFields((t) => ({
      positiveInt: t.field({
        type: 'PositiveInt',
        args: { v: t.arg.int({ required: true }) },
        resolve: (_root, args) => args.v,
      }),
    }));

    const schema = builder.toSchema();
    expect(() =>
      execute({
        schema,
        document: gql`query { positiveInt("hello") }`,
      }),
    ).toThrow('Expected Name, found String "hello"');
  });

  it('when scalars are added using withScalar, the Objects from the user schema are kept', async () => {
    const builder = new SchemaBuilder<{
      Objects: {
        Example: { n: number };
      };
    }>({}).withScalar('PositiveInt', PositiveIntResolver);

    const Example = builder.objectType('Example', {
      fields: (t) => ({
        n: t.expose('n', {
          type: 'PositiveInt',
        }),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        example: t.field({
          type: Example,
          resolve: () => ({ n: 1 }),
        }),
      }),
    });
    const schema = builder.toSchema();

    const result = await execute({
      schema,
      document: gql`
        query {
          example {
            n
          }
        }
      `,
    });
    expect(result.data).toEqual({ example: { n: 1 } });
  });

  it('when scalars are added using withScalar, the Interfaces from the user schema are kept', async () => {
    const builder = new SchemaBuilder<{
      Interfaces: {
        Animal: Animal;
      };
    }>({}).withScalar('NonNegativeInt', NonNegativeIntResolver);

    builder.enumType(Diet, { name: 'Diet' });

    builder.interfaceType('Animal', {
      fields: (t) => ({
        diet: t.expose('diet', {
          exampleRequiredOptionFromPlugin: true,
          type: Diet,
        }),
      }),
    });

    builder.objectType(Kiwi, {
      name: 'Kiwi',
      interfaces: ['Animal'],
      isTypeOf: (value) => value instanceof Kiwi,
      description: 'Long beaks, little legs, rounder than you.',
      fields: (t) => ({
        name: t.exposeString('name', {}),
        age: t.int({
          resolve: (parent) => 5, // hard coded so test don't break over time
        }),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        kiwi: t.field({
          type: 'Animal',
          resolve: () => new Kiwi('TV Kiwi', new Date(Date.UTC(1975, 0, 1)), 0.5),
        }),
      }),
    });

    const schema = builder.toSchema();
    const result = await execute({
      schema,
      document: gql`
        query {
          kiwi {
            name
            age
            heightInMeters
          }
        }
      `,
    });
    expect(result.data).toEqual({ kiwi: { name: 'TV Kiwi', age: 5 } });
  });

  it('when scalars are added using withScalar, the Context from the user schema are kept', async () => {
    const builder = new SchemaBuilder<{
      Context: { name: string };
    }>({}).withScalar('NonNegativeInt', NonNegativeIntResolver);

    builder.queryType({
      fields: (t) => ({
        name: t.field({
          type: 'String',
          resolve: (_root, _args, context) => context.name,
        }),
      }),
    });

    const schema = builder.toSchema();
    const result = await execute({
      schema,
      document: gql`
        query {
          name
        }
      `,
      contextValue: { name: 'Hello' },
    });
    expect(result.data).toEqual({ name: 'Hello' });
  });

  it('when scalars are added using withScalar, the DefaultFieldNullability from the user schema are kept', async () => {
    const builder = new SchemaBuilder<{
      DefaultFieldNullability: true;
    }>({
      defaultFieldNullability: true,
    }).withScalar('NonNegativeInt', NonNegativeIntResolver);

    builder.queryType({
      fields: (t) => ({
        name: t.field({
          type: 'String',
          resolve: () => null,
        }),
      }),
    });

    const schema = builder.toSchema();
    const result = await execute({
      schema,
      document: gql`
        query {
          name
        }
      `,
    });
    expect(result.data).toEqual({ name: null });
  });

  it('when scalars are added using withScalar, the DefaultInputFieldRequiredness from the user schema are kept', async () => {
    const builder = new SchemaBuilder<{
      DefaultInputFieldRequiredness: true;
    }>({
      defaultInputFieldRequiredness: true,
    }).withScalar('NonNegativeInt', NonNegativeIntResolver);

    builder.queryType({
      fields: (t) => ({
        example: t.field({
          type: 'Int',
          args: {
            v: t.arg.int(),
          },
          // Would be a type error here if didn't work
          resolve: (_root, args) => args.v,
        }),
      }),
    });

    const schema = builder.toSchema();
    const result = await execute({
      schema,
      document: gql`
        query {
          example(v: 3)
        }
      `,
    });
    expect(result.data).toEqual({ example: 3 });
  });

  it('when scalars are added withScalar, scalars can still be manually typed', () => {
    const builder = new SchemaBuilder<{
      Scalars: {
        PositiveInt: { Input: number; Output: number };
      };
    }>({}).withScalar('DateTime', DateTimeResolver);

    builder.addScalarType('PositiveInt', PositiveIntResolver, {});

    builder.objectRef<{}>('Example').implement({
      fields: (t) => ({
        // Manual typing
        positiveInt: t.field({
          type: 'PositiveInt',
          resolve: () => 1,
        }),
        // Inferred
        datetime: t.field({
          type: 'DateTime',
          resolve: () => new Date(),
        }),
      }),
    });

    expect(builder).toBeDefined();
  });

  it('when the scalar has internal types the, scalar types are infered are possible', () => {
    const builder = new SchemaBuilder({})
      .withScalar('DateTime', DateTimeResolver)
      .withScalar('PositiveInt', PositiveIntResolver);

    builder.objectRef<{}>('Example').implement({
      fields: (t) => ({
        positiveInt: t.field({
          type: 'PositiveInt',
          resolve: () => 1,
        }),
        datetime: t.field({
          type: 'DateTime',
          resolve: () => new Date(),
        }),
      }),
    });

    expect(builder).toBeDefined();
  });

  it('when a scalar has options', async () => {
    const builder = new SchemaBuilder({})
      .withScalar('HexColor', HexColorCodeResolver)
      .withScalar('HexColorNoHash', HexColorCodeResolver, {
        serialize: (v) => (v as string).slice(1),
      });

    const resolve = () => '#BADA55';

    builder.queryType();
    builder.queryFields((t) => ({
      hex: t.field({ type: 'HexColor', resolve }),
      hexNoHash: t.field({ type: 'HexColorNoHash', resolve }),
    }));

    const schema = builder.toSchema();
    const result = await execute({
      schema,
      document: gql`
        query {
          hex
          hexNoHash
        }
      `,
    });
    expect(result.data).to.deep.eq({ hex: '#BADA55', hexNoHash: 'BADA55' });
  });
});
