import { TypeParam, CompatibleTypes, FieldNullability } from '../types';
import Field from '../graphql/field';
import RootFieldBuilder from './root';

export default class FieldBuilder<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape,
  Interface extends boolean = false
> extends RootFieldBuilder<Types, ParentShape, Interface extends true ? 'Interface' : 'Object'> {
  exposeBoolean<
    Nullable extends FieldNullability<Types, 'Boolean'>,
    Name extends CompatibleTypes<Types, ParentShape, 'Boolean', Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, 'Boolean', Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentShape, 'Boolean', Nullable> {
    return this.exposeField<'Boolean', Nullable, Name>(name, { ...options, type: 'Boolean' });
  }

  exposeFloat<
    Nullable extends FieldNullability<Types, 'Float'>,
    Name extends CompatibleTypes<Types, ParentShape, 'Float', Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, 'Float', Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentShape, 'Float', Nullable> {
    return this.exposeField<'Float', Nullable, Name>(name, { ...options, type: 'Float' });
  }

  exposeID<
    Nullable extends FieldNullability<Types, 'ID'>,
    Name extends CompatibleTypes<Types, ParentShape, 'ID', Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, 'ID', Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentShape, 'ID', Nullable> {
    return this.exposeField<'ID', Nullable, Name>(name, { ...options, type: 'ID' });
  }

  exposeInt<
    Nullable extends FieldNullability<Types, 'Int'>,
    Name extends CompatibleTypes<Types, ParentShape, 'Int', Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, 'Int', Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentShape, 'Int', Nullable> {
    return this.exposeField<'Int', Nullable, Name>(name, { ...options, type: 'Int' });
  }

  exposeString<
    Nullable extends FieldNullability<Types, 'String'>,
    Name extends CompatibleTypes<Types, ParentShape, 'String', Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, 'String', Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentShape, 'String', Nullable> {
    return this.exposeField<'String', Nullable, Name>(name, { ...options, type: 'String' });
  }

  exposeBooleanList<
    Nullable extends FieldNullability<Types, ['Boolean']>,
    Name extends CompatibleTypes<Types, ParentShape, ['Boolean'], Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, ['Boolean'], Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentShape, ['Boolean'], Nullable> {
    return this.exposeField<['Boolean'], Nullable, Name>(name, { ...options, type: ['Boolean'] });
  }

  exposeFloatList<
    Nullable extends FieldNullability<Types, ['Float']>,
    Name extends CompatibleTypes<Types, ParentShape, ['Float'], Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, ['Float'], Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentShape, ['Float'], Nullable> {
    return this.exposeField<['Float'], Nullable, Name>(name, { ...options, type: ['Float'] });
  }

  exposeIDList<
    Nullable extends FieldNullability<Types, ['ID']>,
    Name extends CompatibleTypes<Types, ParentShape, ['ID'], Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, ['ID'], Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentShape, ['ID'], Nullable> {
    return this.exposeField<['ID'], Nullable, Name>(name, { ...options, type: ['ID'] });
  }

  exposeIntList<
    Nullable extends FieldNullability<Types, ['Int']>,
    Name extends CompatibleTypes<Types, ParentShape, ['Int'], Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, ['Int'], Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentShape, ['Int'], Nullable> {
    return this.exposeField<['Int'], Nullable, Name>(name, { ...options, type: ['Int'] });
  }

  exposeStringList<
    Nullable extends FieldNullability<Types, ['String']>,
    Name extends CompatibleTypes<Types, ParentShape, ['String'], Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, ['String'], Nullable, {}>,
      'resolve' | 'type'
    > = {},
  ): Field<{}, Types, ParentShape, ['String'], Nullable> {
    return this.exposeField<['String'], Nullable, Name>(name, { ...options, type: ['String'] });
  }

  expose<
    Type extends TypeParam<Types>,
    Req extends boolean,
    Name extends CompatibleTypes<Types, ParentShape, Type, Req>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, Type, Req, {}>,
      'resolve'
    >,
  ): Field<{}, Types, ParentShape, Type, Req> {
    return this.exposeField(name, options);
  }
}
