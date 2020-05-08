import {
  TypeParam,
  CompatibleTypes,
  FieldOptionsFromKind,
  FieldNullability,
  SchemaTypes,
} from '../types';
import Field from '../graphql/field';
import RootFieldBuilder from './root';

export default class FieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
  Kind extends 'Object' | 'Interface' = 'Object' | 'Interface'
> extends RootFieldBuilder<Types, ParentShape, Kind> {
  exposeBoolean<
    Name extends CompatibleTypes<Types, ParentShape, 'Boolean', Nullable>,
    ResolveReturnShape,
    Nullable extends FieldNullability<'Boolean'> = false
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        'Boolean',
        Nullable,
        {},
        Kind,
        ParentShape,
        ResolveReturnShape
      >,
      'resolve' | 'type'
    >,
  ): Field {
    return this.exposeField<'Boolean', Nullable, Name>(name, { ...options, type: 'Boolean' });
  }

  exposeFloat<
    Name extends CompatibleTypes<Types, ParentShape, 'Float', Nullable>,
    ResolveReturnShape,
    Nullable extends FieldNullability<'Float'> = false
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        'Float',
        Nullable,
        {},
        Kind,
        ParentShape,
        ResolveReturnShape
      >,
      'resolve' | 'type'
    >,
  ): Field {
    return this.exposeField<'Float', Nullable, Name>(name, { ...options, type: 'Float' });
  }

  exposeID<
    Name extends CompatibleTypes<Types, ParentShape, 'ID', Nullable>,
    ResolveReturnShape,
    Nullable extends FieldNullability<'ID'> = false
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        'ID',
        Nullable,
        {},
        Kind,
        ParentShape,
        ResolveReturnShape
      >,
      'resolve' | 'type'
    >,
  ): Field {
    return this.exposeField<'ID', Nullable, Name>(name, { ...options, type: 'ID' });
  }

  exposeInt<
    Name extends CompatibleTypes<Types, ParentShape, 'Int', Nullable>,
    ResolveReturnShape,
    Nullable extends FieldNullability<'Int'> = false
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        'Int',
        Nullable,
        {},
        Kind,
        ParentShape,
        ResolveReturnShape
      >,
      'resolve' | 'type'
    >,
  ): Field {
    return this.exposeField<'Int', Nullable, Name>(name, { ...options, type: 'Int' });
  }

  exposeString<
    Name extends CompatibleTypes<Types, ParentShape, 'String', Nullable>,
    ResolveReturnShape,
    Nullable extends FieldNullability<'String'> = false
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        'String',
        Nullable,
        {},
        Kind,
        ParentShape,
        ResolveReturnShape
      >,
      'resolve' | 'type'
    >,
  ): Field {
    return this.exposeField<'String', Nullable, Name>(name, { ...options, type: 'String' });
  }

  exposeBooleanList<
    Name extends CompatibleTypes<Types, ParentShape, ['Boolean'], Nullable>,
    ResolveReturnShape,
    Nullable extends FieldNullability<['Boolean']> = false
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        ['Boolean'],
        Nullable,
        {},
        Kind,
        ParentShape,
        ResolveReturnShape
      >,
      'resolve' | 'type'
    >,
  ): Field {
    return this.exposeField<['Boolean'], Nullable, Name>(name, { ...options, type: ['Boolean'] });
  }

  exposeFloatList<
    Name extends CompatibleTypes<Types, ParentShape, ['Float'], Nullable>,
    ResolveReturnShape,
    Nullable extends FieldNullability<['Float']> = false
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        ['Float'],
        Nullable,
        {},
        Kind,
        ParentShape,
        ResolveReturnShape
      >,
      'resolve' | 'type'
    >,
  ): Field {
    return this.exposeField<['Float'], Nullable, Name>(name, { ...options, type: ['Float'] });
  }

  exposeIDList<
    Name extends CompatibleTypes<Types, ParentShape, ['ID'], Nullable>,
    ResolveReturnShape,
    Nullable extends FieldNullability<['ID']> = false
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        ['ID'],
        Nullable,
        {},
        Kind,
        ParentShape,
        ResolveReturnShape
      >,
      'resolve' | 'type'
    >,
  ): Field {
    return this.exposeField<['ID'], Nullable, Name>(name, { ...options, type: ['ID'] });
  }

  exposeIntList<
    Name extends CompatibleTypes<Types, ParentShape, ['Int'], Nullable>,
    ResolveReturnShape,
    Nullable extends FieldNullability<['Int']> = false
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        ['Int'],
        Nullable,
        {},
        Kind,
        ParentShape,
        ResolveReturnShape
      >,
      'resolve' | 'type'
    >,
  ): Field {
    return this.exposeField<['Int'], Nullable, Name>(name, { ...options, type: ['Int'] });
  }

  exposeStringList<
    Name extends CompatibleTypes<Types, ParentShape, ['String'], Nullable>,
    ResolveReturnShape,
    Nullable extends FieldNullability<['String']> = false
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        ['String'],
        Nullable,
        {},
        Kind,
        ParentShape,
        ResolveReturnShape
      >,
      'resolve' | 'type'
    >,
  ): Field {
    return this.exposeField<['String'], Nullable, Name>(name, { ...options, type: ['String'] });
  }

  expose<
    Type extends TypeParam<Types>,
    Nullable extends boolean,
    ResolveReturnShape,
    Name extends CompatibleTypes<Types, ParentShape, Type, Nullable>
  >(
    name: Name,
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        Type,
        Nullable,
        {},
        Kind,
        ParentShape,
        ResolveReturnShape
      >,
      'resolve'
    >,
  ): Field {
    return this.exposeField(name, options);
  }
}
