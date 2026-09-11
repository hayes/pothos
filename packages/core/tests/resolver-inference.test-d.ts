import { expectTypeOf } from 'vitest';
import SchemaBuilder, {
  type MaybePromise,
  type Resolver,
  type ResolverWithInferredReturn,
} from '../src';

const builder = new SchemaBuilder<{
  Objects: { Giraffe: { name: string } };
}>({});

const LengthUnit = builder.enumType('LengthUnit', {
  values: { Feet: {}, Meters: {} },
});

const ArrayUnit = builder.enumType('ArrayUnit', {
  values: ['Feet', 'Meters'],
});

type Animal = { kind: 'giraffe'; heightInMeters: number } | { kind: 'lion'; hasMane: boolean };

const AnimalRef = builder.interfaceRef<Animal>('Animal');
const WithTags = builder.objectRef<{ tags: string[] }>('WithTags');
const TaggedAnimal = builder.objectRef<{ kind: 'giraffe'; tags: string[] }>('TaggedAnimal');
const readonlyTags: readonly string[] = ['a'];
class TaggedModel {
  constructor(public tags: string[]) {}

  firstTag() {
    return this.tags[0];
  }
}

builder.objectType(TaggedModel, {
  name: 'TaggedModel',
  fields: (t) => ({ tags: t.exposeStringList('tags') }),
});

test('preserves synchronous literal resolver results and existing promise returns', () => {
  builder.objectType('Giraffe', {
    fields: (t) => ({
      unit: t.field({
        type: LengthUnit,
        resolve: () => 'Feet',
      }),
    }),
  });

  builder.objectField('Giraffe', 'preferredNeckLengthUnit', (t) =>
    t.field({
      type: LengthUnit,
      resolve: () => 'Feet',
    }),
  );

  builder.queryType({
    fields: (t) => ({
      unit: t.field({
        type: LengthUnit,
        resolve: () => 'Feet',
      }),
      asyncUnit: t.field({
        type: LengthUnit,
        resolve: () => Promise.resolve<'Feet' | 'Meters'>('Meters'),
      }),
      arrayUnit: t.field({
        type: ArrayUnit,
        resolve: () => 'Feet',
      }),
      units: t.field({
        type: [LengthUnit],
        resolve: () => ['Feet', 'Meters'],
      }),
      asyncUnits: t.field({
        type: [LengthUnit],
        resolve: () => Promise.resolve<Array<'Feet' | 'Meters'>>(['Feet', 'Meters']),
      }),
      animals: t.field({
        type: [AnimalRef],
        resolve: () => [
          { kind: 'giraffe', heightInMeters: 5.2 },
          { kind: 'lion', hasMane: true },
        ],
      }),
      classInstance: t.field({
        type: TaggedModel,
        resolve: () => new TaggedModel(['a']),
      }),
      iterableUnits: t.field({
        type: [LengthUnit],
        resolve: function* () {
          yield 'Feet';
          yield 'Meters';
        },
      }),
      asyncIterableUnits: t.field({
        type: [LengthUnit],
        // biome-ignore lint/suspicious/useAwait: the fixture tests async iterable resolver types
        resolve: async function* () {
          yield 'Feet';
          yield 'Meters';
        },
      }),
      mutableObject: t.field({
        type: WithTags,
        resolve: () => ({ tags: ['a'] }),
      }),
      mutableObjectList: t.field({
        type: [WithTags],
        resolve: () => [{ tags: ['a'] }],
      }),
      taggedAnimal: t.field({
        type: TaggedAnimal,
        resolve: () => ({ kind: 'giraffe', tags: ['a'] }),
      }),
      taggedAnimalList: t.field({
        type: [TaggedAnimal],
        resolve: () => [{ kind: 'giraffe', tags: ['a'] }],
      }),
      asyncAnimals: t.field({
        type: [AnimalRef],
        resolve: () =>
          Promise.resolve<Animal[]>([
            { kind: 'giraffe', heightInMeters: 5.2 },
            { kind: 'lion', hasMane: true },
          ]),
      }),
    }),
  });
});

test('rejects values that do not match the field type', () => {
  builder.queryFields((t) => ({
    readonlyBackingArray: t.field({
      type: WithTags,
      // @ts-expect-error readonly arrays cannot satisfy mutable backing properties
      resolve: () => ({ tags: readonlyTags }),
    }),
    invalidUnit: t.field({
      type: LengthUnit,
      // @ts-expect-error values outside the enum are not valid resolver results
      resolve: () => 'Yards',
    }),
    invalidAsyncUnit: t.field({
      type: LengthUnit,
      // @ts-expect-error promises must also resolve to a member of the enum
      resolve: async () => 'Yards',
    }),
    invalidUnits: t.field({
      type: [LengthUnit],
      // @ts-expect-error every list item must be a member of the enum
      resolve: () => ['Feet', 'Yards'],
    }),
    invalidAnimals: t.field({
      type: [AnimalRef],
      // @ts-expect-error the discriminator must match an animal backing model
      resolve: () => [{ kind: 'elephant', heightInMeters: 3 }],
    }),
    missingAnimalFields: t.field({
      type: [AnimalRef],
      // @ts-expect-error the selected backing model's required fields must be present
      resolve: () => [{ kind: 'giraffe' }],
    }),
    nonNullableUnit: t.field({
      type: LengthUnit,
      nullable: false,
      // @ts-expect-error non-null enum fields cannot resolve to null
      resolve: () => null,
    }),
    nonNullableItems: t.field({
      type: [LengthUnit],
      // @ts-expect-error list items are non-null by default
      resolve: () => ['Feet', null],
    }),
  }));
});

test('keeps generic backing values and exported resolver contracts', () => {
  function addGenericField<T>(value: T) {
    const Generic = builder.objectRef<{ value: T }>('Generic');
    return builder.queryField('generic', (t) =>
      t.field({
        type: Generic,
        resolve: () => ({ value }),
      }),
    );
  }
  addGenericField({ nested: ['a'] });

  const nullable: Resolver<unknown, {}, {}, string | null> = () => null;
  expectTypeOf(nullable).returns.toEqualTypeOf<MaybePromise<string | null>>();

  const opaque: Resolver<unknown, {}, {}, unknown> = () => undefined;
  expectTypeOf(opaque).returns.toEqualTypeOf<unknown>();

  // biome-ignore lint/suspicious/noExplicitAny: explicit any must not bypass the field's enum type
  type AnyReturn = Resolver<unknown, {}, {}, 'Feet' | 'Meters', any>;
  // @ts-expect-error the return-shape inference parameter cannot widen the allowed enum
  const invalidEnum: AnyReturn = () => 'Yards';
  expectTypeOf(invalidEnum).returns.toEqualTypeOf<MaybePromise<'Feet' | 'Meters'>>();

  // biome-ignore lint/suspicious/noExplicitAny: the inference signature must keep validation with any
  type AnyInferredReturn = ResolverWithInferredReturn<unknown, {}, {}, string, any>;
  // @ts-expect-error the inference signature cannot bypass scalar validation
  const invalidScalar: AnyInferredReturn = () => 123;
  expectTypeOf(invalidScalar).toMatchTypeOf<Resolver<unknown, {}, {}, string>>();
});
