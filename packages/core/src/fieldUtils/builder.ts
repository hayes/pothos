import { TypeParam, CompatibleTypes, FieldNullability, FieldOptionsFromKind } from '../types';
import Field from '../graphql/field';
import RootFieldBuilder from './root';

export default class FieldBuilder<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape,
  Kind extends 'Object' | 'Interface' = 'Object' | 'Interface'
> extends RootFieldBuilder<Types, ParentShape> {
  exposeBoolean<
    Nullable extends FieldNullability<'Boolean'>,
    Name extends CompatibleTypes<Types, ParentShape, 'Boolean', Nullable>
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, 'Boolean', Nullable, {}, Kind>,
      'resolve' | 'type'
    >,
  ): Field<{}, Types, 'Boolean'> {
    return this.exposeField<'Boolean', Nullable, Name>(name, { ...options, type: 'Boolean' });
  }

  exposeFloat<
    Nullable extends FieldNullability<'Float'>,
    Name extends CompatibleTypes<Types, ParentShape, 'Float', Nullable>
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, 'Float', Nullable, {}, Kind>,
      'resolve' | 'type'
    >,
  ): Field<{}, Types, 'Float'> {
    return this.exposeField<'Float', Nullable, Name>(name, { ...options, type: 'Float' });
  }

  exposeID<
    Nullable extends FieldNullability<'ID'>,
    Name extends CompatibleTypes<Types, ParentShape, 'ID', Nullable>
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, 'ID', Nullable, {}, Kind>,
      'resolve' | 'type'
    >,
  ): Field<{}, Types, 'ID'> {
    return this.exposeField<'ID', Nullable, Name>(name, { ...options, type: 'ID' });
  }

  exposeInt<
    Nullable extends FieldNullability<'Int'>,
    Name extends CompatibleTypes<Types, ParentShape, 'Int', Nullable>
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, 'Int', Nullable, {}, Kind>,
      'resolve' | 'type'
    >,
  ): Field<{}, Types, 'Int'> {
    return this.exposeField<'Int', Nullable, Name>(name, { ...options, type: 'Int' });
  }

  exposeString<
    Nullable extends FieldNullability<'String'>,
    Name extends CompatibleTypes<Types, ParentShape, 'String', Nullable>
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, 'String', Nullable, {}, Kind>,
      'resolve' | 'type'
    >,
  ): Field<{}, Types, 'String'> {
    return this.exposeField<'String', Nullable, Name>(name, { ...options, type: 'String' });
  }

  exposeBooleanList<
    Nullable extends FieldNullability<['Boolean']>,
    Name extends CompatibleTypes<Types, ParentShape, ['Boolean'], Nullable>
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, ['Boolean'], Nullable, {}, Kind>,
      'resolve' | 'type'
    >,
  ): Field<{}, Types, ['Boolean']> {
    return this.exposeField<['Boolean'], Nullable, Name>(name, { ...options, type: ['Boolean'] });
  }

  exposeFloatList<
    Nullable extends FieldNullability<['Float']>,
    Name extends CompatibleTypes<Types, ParentShape, ['Float'], Nullable>
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, ['Float'], Nullable, {}, Kind>,
      'resolve' | 'type'
    >,
  ): Field<{}, Types, ['Float']> {
    return this.exposeField<['Float'], Nullable, Name>(name, { ...options, type: ['Float'] });
  }

  exposeIDList<
    Nullable extends FieldNullability<['ID']>,
    Name extends CompatibleTypes<Types, ParentShape, ['ID'], Nullable>
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, ['ID'], Nullable, {}, Kind>,
      'resolve' | 'type'
    >,
  ): Field<{}, Types, ['ID']> {
    return this.exposeField<['ID'], Nullable, Name>(name, { ...options, type: ['ID'] });
  }

  exposeIntList<
    Nullable extends FieldNullability<['Int']>,
    Name extends CompatibleTypes<Types, ParentShape, ['Int'], Nullable>
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, ['Int'], Nullable, {}, Kind>,
      'resolve' | 'type'
    >,
  ): Field<{}, Types, ['Int']> {
    return this.exposeField<['Int'], Nullable, Name>(name, { ...options, type: ['Int'] });
  }

  exposeStringList<
    Nullable extends FieldNullability<['String']>,
    Name extends CompatibleTypes<Types, ParentShape, ['String'], Nullable>
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, ['String'], Nullable, {}, Kind>,
      'resolve' | 'type'
    >,
  ): Field<{}, Types, ['String']> {
    return this.exposeField<['String'], Nullable, Name>(name, { ...options, type: ['String'] });
  }

  expose<
    Type extends TypeParam<Types>,
    Nullable extends boolean,
    Name extends CompatibleTypes<Types, ParentShape, Type, Nullable>
  >(
    name: Name,
    options: Omit<FieldOptionsFromKind<Types, ParentShape, Type, Nullable, {}, Kind>, 'resolve'>,
  ): Field<{}, Types, Type> {
    return this.exposeField(name, options);
  }
}
