import { FieldOptionsFromKind, TypeParam, InputFields, FieldNullability } from '../types';
import Field from '../graphql/field';
import BaseFieldUtil from './base';
import InputFieldBuilder from './input';

export default class RootFieldBuilder<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape,
  Kind extends 'Object' | 'Interface' | 'Root' | 'Subscription'
> extends BaseFieldUtil<Types, ParentShape, Kind> {
  arg = new InputFieldBuilder<Types>().callableBuilder();

  boolean<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, 'Boolean'>>(
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, 'Boolean', Nullable, Args, Kind>,
      'type'
    >,
  ): Field<Args, Types, ParentShape, 'Boolean', Nullable, Kind> {
    return this.createField<Args, 'Boolean', Nullable, null>(
      { ...options, type: 'Boolean' } as FieldOptionsFromKind<
        Types,
        ParentShape,
        'Boolean',
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  float<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, 'Flaot'>>(
    options: Omit<FieldOptionsFromKind<Types, ParentShape, 'Float', Nullable, Args, Kind>, 'type'>,
  ): Field<Args, Types, ParentShape, 'Float', Nullable> {
    return this.createField<Args, 'Float', Nullable, null>(
      { ...options, type: 'Float' } as FieldOptionsFromKind<
        Types,
        ParentShape,
        'Float',
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  id<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, 'ID'>>(
    options: Omit<FieldOptionsFromKind<Types, ParentShape, 'ID', Nullable, Args, Kind>, 'type'>,
  ): Field<Args, Types, ParentShape, 'ID', Nullable> {
    return this.createField<Args, 'ID', Nullable, null>(
      { ...options, type: 'ID' } as FieldOptionsFromKind<
        Types,
        ParentShape,
        'ID',
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  int<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, 'Int'>>(
    options: Omit<FieldOptionsFromKind<Types, ParentShape, 'Int', Nullable, Args, Kind>, 'type'>,
  ): Field<Args, Types, ParentShape, 'Int', Nullable> {
    return this.createField<Args, 'Int', Nullable, null>(
      { ...options, type: 'Int' } as FieldOptionsFromKind<
        Types,
        ParentShape,
        'Int',
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  string<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, 'String'>>(
    options: Omit<FieldOptionsFromKind<Types, ParentShape, 'String', Nullable, Args, Kind>, 'type'>,
  ): Field<Args, Types, ParentShape, 'String', Nullable> {
    return this.createField<Args, 'String', Nullable, null>(
      { ...options, type: 'String' } as FieldOptionsFromKind<
        Types,
        ParentShape,
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
      FieldOptionsFromKind<Types, ParentShape, ['Boolean'], Nullable, Args, Kind>,
      'type'
    >,
  ): Field<Args, Types, ParentShape, ['Boolean'], Nullable> {
    return this.createField<Args, ['Boolean'], Nullable, null>(
      { ...options, type: ['Boolean'] } as FieldOptionsFromKind<
        Types,
        ParentShape,
        ['Boolean'],
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  floatList<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, ['Float']>>(
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, ['Float'], Nullable, Args, Kind>,
      'type'
    >,
  ): Field<Args, Types, ParentShape, ['Float'], Nullable> {
    return this.createField<Args, ['Float'], Nullable, null>(
      { ...options, type: ['Float'] } as FieldOptionsFromKind<
        Types,
        ParentShape,
        ['Float'],
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  idList<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, ['ID']>>(
    options: Omit<FieldOptionsFromKind<Types, ParentShape, ['ID'], Nullable, Args, Kind>, 'type'>,
  ): Field<Args, Types, ParentShape, ['ID'], Nullable> {
    return this.createField<Args, ['ID'], Nullable, null>(
      { ...options, type: ['ID'] } as FieldOptionsFromKind<
        Types,
        ParentShape,
        ['ID'],
        Nullable,
        Args,
        Kind
      >,
      null,
    );
  }

  intList<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, ['Int']>>(
    options: Omit<FieldOptionsFromKind<Types, ParentShape, ['Int'], Nullable, Args, Kind>, 'type'>,
  ): Field<Args, Types, ParentShape, ['Int'], Nullable> {
    return this.createField<Args, ['Int'], Nullable, null>(
      { ...options, type: ['Int'] } as FieldOptionsFromKind<
        Types,
        ParentShape,
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
      FieldOptionsFromKind<Types, ParentShape, ['String'], Nullable, Args, Kind>,
      'type'
    >,
  ): Field<Args, Types, ParentShape, ['String'], Nullable> {
    return this.createField<Args, ['String'], Nullable, null>(
      { ...options, type: ['String'] } as FieldOptionsFromKind<
        Types,
        ParentShape,
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
    options: FieldOptionsFromKind<Types, ParentShape, Type, Req, Args, Kind>,
  ): Field<Args, Types, ParentShape, Type, Req> {
    return this.createField(options, null);
  }
}
