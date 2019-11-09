import { TypeParam, InputFields, CompatibleTypes, NamedTypeParam } from '../types';
import Field from '../field';
import BaseFieldUtil from './base';
import FieldModifier from './modifier';
import InputFieldBuilder from './input';

export default class FieldBuilder<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentType extends TypeParam<Types>,
  ParentShape extends {
    [s: string]: Field<{}, Types, TypeParam<Types>, TypeParam<Types>, boolean, string | null, any>;
  }
> extends BaseFieldUtil<Types, ParentType> {
  parentFields: ParentShape;

  modifiers: {
    [K in keyof ParentShape]: FieldModifier<
      Types,
      ParentType,
      ParentShape[K]['type'],
      ParentShape[K]['nullable'],
      ParentShape[K]['args'],
      Extract<K, string>
    >;
  };

  constructor(parentFields: ParentShape, typename: NamedTypeParam<Types>) {
    super(typename);

    this.parentFields = parentFields;

    const modifiers: Partial<
      {
        [K in keyof ParentShape]: FieldModifier<
          Types,
          ParentType,
          ParentShape[K]['type'],
          ParentShape[K]['nullable'],
          ParentShape[K]['args'],
          Extract<K, string>
        >;
      }
    > = {};

    (Object.keys(parentFields) as (Extract<keyof ParentShape, string>)[]).forEach(name => {
      modifiers[name] = new FieldModifier(parentFields[name], name, this.typename) as any;
    });

    this.modifiers = modifiers as {
      [K in keyof typeof modifiers]-?: Exclude<(typeof modifiers)[K], undefined>;
    };
  }

  arg = new InputFieldBuilder<Types>().callableBuilder();

  boolean<Args extends InputFields<Types>, Nullable extends boolean>(
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, 'Boolean', Nullable, Args>,
      'type'
    >,
  ): Field<Args, Types, ParentType, 'Boolean', Nullable, null> {
    return this.createField<Args, 'Boolean', Nullable, null>({ ...options, type: 'Boolean' }, null);
  }

  float<Args extends InputFields<Types>, Nullable extends boolean>(
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, 'Float', Nullable, Args>,
      'type'
    >,
  ): Field<Args, Types, ParentType, 'Float', Nullable, null> {
    return this.createField<Args, 'Float', Nullable, null>({ ...options, type: 'Float' }, null);
  }

  id<Args extends InputFields<Types>, Nullable extends boolean>(
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, 'ID', Nullable, Args>,
      'type'
    >,
  ): Field<Args, Types, ParentType, 'ID', Nullable, null> {
    return this.createField<Args, 'ID', Nullable, null>({ ...options, type: 'ID' }, null);
  }

  int<Args extends InputFields<Types>, Nullable extends boolean>(
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, 'Int', Nullable, Args>,
      'type'
    >,
  ): Field<Args, Types, ParentType, 'Int', Nullable, null> {
    return this.createField<Args, 'Int', Nullable, null>({ ...options, type: 'Int' }, null);
  }

  string<Args extends InputFields<Types>, Nullable extends boolean>(
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, 'String', Nullable, Args>,
      'type'
    >,
  ): Field<Args, Types, ParentType, 'String', Nullable, null> {
    return this.createField<Args, 'String', Nullable, null>({ ...options, type: 'String' }, null);
  }

  booleanList<Args extends InputFields<Types>, Nullable extends boolean>(
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, ['Boolean'], Nullable, Args>,
      'type'
    >,
  ): Field<Args, Types, ParentType, ['Boolean'], Nullable, null> {
    return this.createField<Args, ['Boolean'], Nullable, null>(
      { ...options, type: ['Boolean'] },
      null,
    );
  }

  floatList<Args extends InputFields<Types>, Nullable extends boolean>(
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, ['Float'], Nullable, Args>,
      'type'
    >,
  ): Field<Args, Types, ParentType, ['Float'], Nullable, null> {
    return this.createField<Args, ['Float'], Nullable, null>({ ...options, type: ['Float'] }, null);
  }

  idList<Args extends InputFields<Types>, Nullable extends boolean>(
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, ['ID'], Nullable, Args>,
      'type'
    >,
  ): Field<Args, Types, ParentType, ['ID'], Nullable, null> {
    return this.createField<Args, ['ID'], Nullable, null>({ ...options, type: ['ID'] }, null);
  }

  intList<Args extends InputFields<Types>, Nullable extends boolean>(
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, ['Int'], Nullable, Args>,
      'type'
    >,
  ): Field<Args, Types, ParentType, ['Int'], Nullable, null> {
    return this.createField<Args, ['Int'], Nullable, null>({ ...options, type: ['Int'] }, null);
  }

  stringList<Args extends InputFields<Types>, Nullable extends boolean>(
    options: Omit<
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, ['String'], Nullable, Args>,
      'type'
    >,
  ): Field<Args, Types, ParentType, ['String'], Nullable, null> {
    return this.createField<Args, ['String'], Nullable, null>(
      { ...options, type: ['String'] },
      null,
    );
  }

  exposBoolean<
    Nullable extends boolean,
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
    Nullable extends boolean,
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
    Nullable extends boolean,
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
    Nullable extends boolean,
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
    Nullable extends boolean,
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
    Nullable extends boolean,
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
    Nullable extends boolean,
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
    Nullable extends boolean,
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
    Nullable extends boolean,
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
    Nullable extends boolean,
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

  field<Args extends InputFields<Types>, Type extends TypeParam<Types>, Req extends boolean>(
    options: GiraphQLSchemaTypes.FieldOptions<Types, ParentType, Type, Req, Args>,
  ): Field<Args, Types, ParentType, Type, Req, null> {
    return this.createField(options, null);
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
