import { FieldOptionsFromKind, TypeParam, InputFields, FieldNullability } from '../types';
import Field from '../graphql/field';
import BaseFieldUtil from './base';
import InputFieldBuilder from './input';

export default class RootFieldBuilder<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentType extends TypeParam<Types>,
  Kind extends 'Object' | 'Interface' | 'Root' | 'Subscription'
> extends BaseFieldUtil<Types, ParentType, Kind> {
  arg = new InputFieldBuilder<Types>().callableBuilder();

  boolean<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, 'Boolean'>>(
    options: Omit<FieldOptionsFromKind<Types, ParentType, 'Boolean', Nullable, Args, Kind>, 'type'>,
  ): Field<Args, Types, ParentType, 'Boolean', Nullable, null, Kind> {
    return this.createField<Args, 'Boolean', Nullable, null>(
      { ...options, type: 'Boolean' } as FieldOptionsFromKind<
        Types,
        ParentType,
        'Boolean',
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  float<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, 'Flaot'>>(
    options: Omit<FieldOptionsFromKind<Types, ParentType, 'Float', Nullable, Args, Kind>, 'type'>,
  ): Field<Args, Types, ParentType, 'Float', Nullable, null> {
    return this.createField<Args, 'Float', Nullable, null>(
      { ...options, type: 'Float' } as FieldOptionsFromKind<
        Types,
        ParentType,
        'Float',
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  id<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, 'ID'>>(
    options: Omit<FieldOptionsFromKind<Types, ParentType, 'ID', Nullable, Args, Kind>, 'type'>,
  ): Field<Args, Types, ParentType, 'ID', Nullable, null> {
    return this.createField<Args, 'ID', Nullable, null>(
      { ...options, type: 'ID' } as FieldOptionsFromKind<
        Types,
        ParentType,
        'ID',
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  int<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, 'Int'>>(
    options: Omit<FieldOptionsFromKind<Types, ParentType, 'Int', Nullable, Args, Kind>, 'type'>,
  ): Field<Args, Types, ParentType, 'Int', Nullable, null> {
    return this.createField<Args, 'Int', Nullable, null>(
      { ...options, type: 'Int' } as FieldOptionsFromKind<
        Types,
        ParentType,
        'Int',
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  string<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, 'String'>>(
    options: Omit<FieldOptionsFromKind<Types, ParentType, 'String', Nullable, Args, Kind>, 'type'>,
  ): Field<Args, Types, ParentType, 'String', Nullable, null> {
    return this.createField<Args, 'String', Nullable, null>(
      { ...options, type: 'String' } as FieldOptionsFromKind<
        Types,
        ParentType,
        'String',
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  booleanList<
    Args extends InputFields<Types>,
    Nullable extends FieldNullability<Types, ['Boolean']>
  >(
    options: Omit<
      FieldOptionsFromKind<Types, ParentType, ['Boolean'], Nullable, Args, Kind>,
      'type'
    >,
  ): Field<Args, Types, ParentType, ['Boolean'], Nullable, null> {
    return this.createField<Args, ['Boolean'], Nullable, null>(
      { ...options, type: ['Boolean'] } as FieldOptionsFromKind<
        Types,
        ParentType,
        ['Boolean'],
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  floatList<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, ['Float']>>(
    options: Omit<FieldOptionsFromKind<Types, ParentType, ['Float'], Nullable, Args, Kind>, 'type'>,
  ): Field<Args, Types, ParentType, ['Float'], Nullable, null> {
    return this.createField<Args, ['Float'], Nullable, null>(
      { ...options, type: ['Float'] } as FieldOptionsFromKind<
        Types,
        ParentType,
        ['Float'],
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  idList<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, ['ID']>>(
    options: Omit<FieldOptionsFromKind<Types, ParentType, ['ID'], Nullable, Args, Kind>, 'type'>,
  ): Field<Args, Types, ParentType, ['ID'], Nullable, null> {
    return this.createField<Args, ['ID'], Nullable, null>(
      { ...options, type: ['ID'] } as FieldOptionsFromKind<
        Types,
        ParentType,
        ['ID'],
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  intList<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, ['Int']>>(
    options: Omit<FieldOptionsFromKind<Types, ParentType, ['Int'], Nullable, Args, Kind>, 'type'>,
  ): Field<Args, Types, ParentType, ['Int'], Nullable, null> {
    return this.createField<Args, ['Int'], Nullable, null>(
      { ...options, type: ['Int'] } as FieldOptionsFromKind<
        Types,
        ParentType,
        ['Int'],
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  stringList<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, ['String']>>(
    options: Omit<
      FieldOptionsFromKind<Types, ParentType, ['String'], Nullable, Args, Kind>,
      'type'
    >,
  ): Field<Args, Types, ParentType, ['String'], Nullable, null> {
    return this.createField<Args, ['String'], Nullable, null>(
      { ...options, type: ['String'] } as FieldOptionsFromKind<
        Types,
        ParentType,
        ['String'],
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  field<
    Args extends InputFields<Types>,
    Type extends TypeParam<Types>,
    Req extends FieldNullability<Types, Type>
  >(
    options: FieldOptionsFromKind<Types, ParentType, Type, Req, Args, Kind>,
  ): Field<Args, Types, ParentType, Type, Req, null> {
    return this.createField(options, null);
  }
}
