import {
  TypeParam,
  InputFields,
  FieldNullability,
  FieldOptionsFromKind,
  FieldKind,
} from '../types';
import Field from '../graphql/field';
import BaseFieldUtil from './base';
import InputFieldBuilder from './input';

export default class RootFieldBuilder<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape,
  Kind extends FieldKind = FieldKind
> extends BaseFieldUtil<Types, ParentShape> {
  arg = new InputFieldBuilder<Types>().callableBuilder();

  boolean<
    Args extends InputFields<Types>,
    Nullable extends FieldNullability<'Boolean'>,
    ResolveShape
  >(
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, 'Boolean', Nullable, Args, Kind, ResolveShape>,
      'type'
    >,
  ): Field<Args, Types, 'Boolean'> {
    return this.createField<Args, 'Boolean', Nullable>({
      ...options,
      type: 'Boolean',
    });
  }

  float<Args extends InputFields<Types>, Nullable extends FieldNullability<'Float'>, ResolveShape>(
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, 'Float', Nullable, Args, Kind, ResolveShape>,
      'type'
    >,
  ): Field<Args, Types, 'Float'> {
    return this.createField<Args, 'Float', Nullable>({
      ...options,
      type: 'Float',
    });
  }

  id<Args extends InputFields<Types>, Nullable extends FieldNullability<'ID'>, ResolveShape>(
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, 'ID', Nullable, Args, Kind, ResolveShape>,
      'type'
    >,
  ): Field<Args, Types, 'ID'> {
    return this.createField<Args, 'ID', Nullable>({ ...options, type: 'ID' });
  }

  int<Args extends InputFields<Types>, Nullable extends FieldNullability<'Int'>, ResolveShape>(
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, 'Int', Nullable, Args, Kind, ResolveShape>,
      'type'
    >,
  ): Field<Args, Types, 'Int'> {
    return this.createField<Args, 'Int', Nullable>({ ...options, type: 'Int' });
  }

  string<
    Args extends InputFields<Types>,
    Nullable extends FieldNullability<'String'>,
    ResolveShape
  >(
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, 'String', Nullable, Args, Kind, ResolveShape>,
      'type'
    >,
  ): Field<Args, Types, 'String'> {
    return this.createField<Args, 'String', Nullable>({
      ...options,
      type: 'String',
    });
  }

  booleanList<
    Args extends InputFields<Types>,
    Nullable extends FieldNullability<['Boolean']>,
    ResolveShape
  >(
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, ['Boolean'], Nullable, Args, Kind, ResolveShape>,
      'type'
    >,
  ): Field<Args, Types, ['Boolean']> {
    return this.createField<Args, ['Boolean'], Nullable>({ ...options, type: ['Boolean'] });
  }

  floatList<
    Args extends InputFields<Types>,
    Nullable extends FieldNullability<['Float']>,
    ResolveShape
  >(
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, ['Float'], Nullable, Args, Kind, ResolveShape>,
      'type'
    >,
  ): Field<Args, Types, ['Float']> {
    return this.createField<Args, ['Float'], Nullable>({ ...options, type: ['Float'] });
  }

  idList<Args extends InputFields<Types>, Nullable extends FieldNullability<['ID']>, ResolveShape>(
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, ['ID'], Nullable, Args, Kind, ResolveShape>,
      'type'
    >,
  ): Field<Args, Types, ['ID']> {
    return this.createField<Args, ['ID'], Nullable>({ ...options, type: ['ID'] });
  }

  intList<
    Args extends InputFields<Types>,
    Nullable extends FieldNullability<['Int']>,
    ResolveShape
  >(
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, ['Int'], Nullable, Args, Kind, ResolveShape>,
      'type'
    >,
  ): Field<Args, Types, ['Int']> {
    return this.createField<Args, ['Int'], Nullable>({ ...options, type: ['Int'] });
  }

  stringList<
    Args extends InputFields<Types>,
    Nullable extends FieldNullability<['String']>,
    ResolveShape
  >(
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, ['String'], Nullable, Args, Kind, ResolveShape>,
      'type'
    >,
  ): Field<Args, Types, ['String']> {
    return this.createField<Args, ['String'], Nullable>({ ...options, type: ['String'] });
  }

  field<
    Args extends InputFields<Types>,
    Type extends TypeParam<Types>,
    Nullable extends FieldNullability<Type>,
    ResolveShape
  >(
    options: FieldOptionsFromKind<Types, ParentShape, Type, Nullable, Args, Kind, ResolveShape>,
  ): Field<Args, Types, Type> {
    return this.createField(options);
  }
}
