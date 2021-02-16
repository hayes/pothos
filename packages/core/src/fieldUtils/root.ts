import {
  FieldKind,
  FieldNullability,
  FieldOptionsFromKind,
  SchemaTypes,
  TypeParam,
} from '../types';
import BaseFieldUtil from './base';
import InputFieldBuilder from './input';

import { ArgBuilder, InputFieldMap } from '..';

export default class RootFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
  Kind extends FieldKind = FieldKind
> extends BaseFieldUtil<Types, ParentShape, Kind> {
  arg: ArgBuilder<Types> = new InputFieldBuilder<Types, 'Arg'>(
    this.builder,
    'Arg',
    this.typename,
  ).argBuilder();

  boolean<
    Args extends InputFieldMap,
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<'Boolean'> = Types['DefaultFieldNullability']
  >(
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        'Boolean',
        Nullable,
        Args,
        Kind,
        ResolveShape,
        ResolveReturnShape
      >,
      'type'
    >,
  ) {
    return this.createField<Args, 'Boolean', Nullable>({
      ...options,
      type: 'Boolean',
    });
  }

  float<
    Args extends InputFieldMap,
    Nullable extends FieldNullability<'Float'>,
    ResolveShape,
    ResolveReturnShape
  >(
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        'Float',
        Nullable,
        Args,
        Kind,
        ResolveShape,
        ResolveReturnShape
      >,
      'type'
    >,
  ) {
    return this.createField<Args, 'Float', Nullable>({
      ...options,
      type: 'Float',
    });
  }

  id<
    Args extends InputFieldMap,
    Nullable extends FieldNullability<'ID'>,
    ResolveShape,
    ResolveReturnShape
  >(
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        'ID',
        Nullable,
        Args,
        Kind,
        ResolveShape,
        ResolveReturnShape
      >,
      'type'
    >,
  ) {
    return this.createField<Args, 'ID', Nullable>({ ...options, type: 'ID' });
  }

  int<
    Args extends InputFieldMap,
    Nullable extends FieldNullability<'Int'>,
    ResolveShape,
    ResolveReturnShape
  >(
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        'Int',
        Nullable,
        Args,
        Kind,
        ResolveShape,
        ResolveReturnShape
      >,
      'type'
    >,
  ) {
    return this.createField<Args, 'Int', Nullable>({ ...options, type: 'Int' });
  }

  string<
    Args extends InputFieldMap,
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<'String'> = Types['DefaultFieldNullability']
  >(
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        'String',
        Nullable,
        Args,
        Kind,
        ResolveShape,
        ResolveReturnShape
      >,
      'type'
    >,
  ) {
    return this.createField<Args, 'String', Nullable>({
      ...options,
      type: 'String',
    });
  }

  booleanList<
    Args extends InputFieldMap,
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<['Boolean']> = Types['DefaultFieldNullability']
  >(
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        ['Boolean'],
        Nullable,
        Args,
        Kind,
        ResolveShape,
        ResolveReturnShape
      >,
      'type'
    >,
  ) {
    return this.createField<Args, ['Boolean'], Nullable>({ ...options, type: ['Boolean'] });
  }

  floatList<
    Args extends InputFieldMap,
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<['Float']> = Types['DefaultFieldNullability']
  >(
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        ['Float'],
        Nullable,
        Args,
        Kind,
        ResolveShape,
        ResolveReturnShape
      >,
      'type'
    >,
  ) {
    return this.createField<Args, ['Float'], Nullable>({ ...options, type: ['Float'] });
  }

  idList<
    Args extends InputFieldMap,
    Nullable extends FieldNullability<['ID']>,
    ResolveShape,
    ResolveReturnShape
  >(
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        ['ID'],
        Nullable,
        Args,
        Kind,
        ResolveShape,
        ResolveReturnShape
      >,
      'type'
    >,
  ) {
    return this.createField<Args, ['ID'], Nullable>({ ...options, type: ['ID'] });
  }

  intList<
    Args extends InputFieldMap,
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<['Int']> = Types['DefaultFieldNullability']
  >(
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        ['Int'],
        Nullable,
        Args,
        Kind,
        ResolveShape,
        ResolveReturnShape
      >,
      'type'
    >,
  ) {
    return this.createField<Args, ['Int'], Nullable>({ ...options, type: ['Int'] });
  }

  stringList<
    Args extends InputFieldMap,
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<['String']> = Types['DefaultFieldNullability']
  >(
    options: Omit<
      FieldOptionsFromKind<
        Types,
        ParentShape,
        ['String'],
        Nullable,
        Args,
        Kind,
        ResolveShape,
        ResolveReturnShape
      >,
      'type'
    >,
  ) {
    return this.createField<Args, ['String'], Nullable>({ ...options, type: ['String'] });
  }

  field<
    Args extends InputFieldMap,
    Type extends TypeParam<Types>,
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<Type> = Types['DefaultFieldNullability']
  >(
    options: FieldOptionsFromKind<
      Types,
      ParentShape,
      Type,
      Nullable,
      Args,
      Kind,
      ResolveShape,
      ResolveReturnShape
    >,
  ) {
    return this.createField<Args, Type, Nullable>(options);
  }
}
