import { TypeParam, CompatibleTypes, FieldNullability } from '../types';
import Field from '../graphql/field';
import FieldModifier from './modifier';
import RootFieldBuilder from './root';

export default class FieldBuilder<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentType extends TypeParam<Types>,
  ParentShape extends {
    [s: string]: Field<
      {},
      Types,
      TypeParam<Types>,
      TypeParam<Types>,
      FieldNullability<Types, TypeParam<Types>>,
      string | null,
      any
    >;
  }
> extends RootFieldBuilder<Types, ParentType> {
  parentFields: ParentShape;

  modifiers: {
    [K in keyof ParentShape]: FieldModifier<
      Types,
      ParentType,
      ParentShape[K]['type'],
      FieldNullability<Types, ParentShape[K]['type']>,
      ParentShape[K]['args'],
      Extract<K, string>
    >;
  };

  constructor(parentFields: ParentShape, typename: string) {
    super(typename);

    this.parentFields = parentFields;

    const modifiers: Partial<
      {
        [K in keyof ParentShape]: FieldModifier<
          Types,
          ParentType,
          ParentShape[K]['type'],
          FieldNullability<Types, ParentShape[K]['type']>,
          ParentShape[K]['args'],
          Extract<K, string>
        >;
      }
    > = {};

    (Object.keys(parentFields) as Extract<keyof ParentShape, string>[]).forEach(name => {
      modifiers[name] = new FieldModifier(parentFields[name], name, this.typename) as any;
    });

    this.modifiers = modifiers as {
      [K in keyof typeof modifiers]-?: Exclude<typeof modifiers[K], undefined>;
    };
  }

  exposBoolean<
    Nullable extends FieldNullability<Types, 'Boolean'>,
    Name extends CompatibleTypes<Types, ParentType, 'Boolean', Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, 'Boolean', Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentType, 'Boolean', Nullable, null> {
    return this.exposeField<'Boolean', Nullable, Name, null>(
      name,
      { ...options, type: 'Boolean' },
      null,
    );
  }

  exposeFloat<
    Nullable extends FieldNullability<Types, 'Float'>,
    Name extends CompatibleTypes<Types, ParentType, 'Float', Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, 'Float', Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentType, 'Float', Nullable, null> {
    return this.exposeField<'Float', Nullable, Name, null>(
      name,
      { ...options, type: 'Float' },
      null,
    );
  }

  exposeID<
    Nullable extends FieldNullability<Types, 'ID'>,
    Name extends CompatibleTypes<Types, ParentType, 'ID', Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, 'ID', Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentType, 'ID', Nullable, null> {
    return this.exposeField<'ID', Nullable, Name, null>(name, { ...options, type: 'ID' }, null);
  }

  exposeInt<
    Nullable extends FieldNullability<Types, 'Int'>,
    Name extends CompatibleTypes<Types, ParentType, 'Int', Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, 'Int', Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentType, 'Int', Nullable, null> {
    return this.exposeField<'Int', Nullable, Name, null>(name, { ...options, type: 'Int' }, null);
  }

  exposeString<
    Nullable extends FieldNullability<Types, 'String'>,
    Name extends CompatibleTypes<Types, ParentType, 'String', Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, 'String', Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentType, 'String', Nullable, null> {
    return this.exposeField<'String', Nullable, Name, null>(
      name,
      { ...options, type: 'String' },
      null,
    );
  }

  exposeBooleanList<
    Nullable extends FieldNullability<Types, ['Boolean']>,
    Name extends CompatibleTypes<Types, ParentType, ['Boolean'], Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, ['Boolean'], Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentType, ['Boolean'], Nullable, null> {
    return this.exposeField<['Boolean'], Nullable, Name, null>(
      name,
      { ...options, type: ['Boolean'] },
      null,
    );
  }

  exposeFloatList<
    Nullable extends FieldNullability<Types, ['Float']>,
    Name extends CompatibleTypes<Types, ParentType, ['Float'], Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, ['Float'], Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentType, ['Float'], Nullable, null> {
    return this.exposeField<['Float'], Nullable, Name, null>(
      name,
      { ...options, type: ['Float'] },
      null,
    );
  }

  exposeIDList<
    Nullable extends FieldNullability<Types, ['ID']>,
    Name extends CompatibleTypes<Types, ParentType, ['ID'], Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, ['ID'], Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentType, ['ID'], Nullable, null> {
    return this.exposeField<['ID'], Nullable, Name, null>(name, { ...options, type: ['ID'] }, null);
  }

  exposeIntList<
    Nullable extends FieldNullability<Types, ['Int']>,
    Name extends CompatibleTypes<Types, ParentType, ['Int'], Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, ['Int'], Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentType, ['Int'], Nullable, null> {
    return this.exposeField<['Int'], Nullable, Name, null>(
      name,
      { ...options, type: ['Int'] },
      null,
    );
  }

  exposeStringList<
    Nullable extends FieldNullability<Types, ['String']>,
    Name extends CompatibleTypes<Types, ParentType, ['String'], Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, ['String'], Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentType, ['String'], Nullable, null> {
    return this.exposeField<['String'], Nullable, Name, null>(
      name,
      { ...options, type: ['String'] },
      null,
    );
  }

  expose<
    Type extends TypeParam<Types>,
    Req extends boolean,
    Name extends CompatibleTypes<Types, ParentType, Type, Req>
  >(
    name: Name,
    options: Omit<GiraphQLSchemaTypes.FieldOptions<Types, ParentType, Type, Req, {}>, 'resolve'>,
  ): Field<{}, Types, ParentType, Type, Req, null> {
    return this.exposeField(name, options, null);
  }

  extend<Name extends keyof ParentShape>(name: Name) {
    return this.modifiers[name];
  }
}
