import { TypeParam, InputFields, FieldNullability, MaybeSubscriptionFieldOptions } from '../types';
import Field from '../graphql/field';
import BaseFieldUtil from './base';
import InputFieldBuilder from './input';

export default class RootFieldBuilder<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentType extends TypeParam<Types>,
  Subscription extends boolean = false
> extends BaseFieldUtil<Types, ParentType> {
  arg = new InputFieldBuilder<Types>().callableBuilder();

  boolean<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, 'Boolean'>>(
    options: Omit<
      MaybeSubscriptionFieldOptions<Types, ParentType, 'Boolean', Nullable, Args, Subscription>,
      'type'
    >,
  ): Field<Args, Types, ParentType, 'Boolean', Nullable, null> {
    return this.createField<Args, 'Boolean', Nullable, null>({ ...options, type: 'Boolean' }, null);
  }

  float<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, 'Flaot'>>(
    options: Omit<
      MaybeSubscriptionFieldOptions<Types, ParentType, 'Float', Nullable, Args, Subscription>,
      'type'
    >,
  ): Field<Args, Types, ParentType, 'Float', Nullable, null> {
    return this.createField<Args, 'Float', Nullable, null>({ ...options, type: 'Float' }, null);
  }

  id<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, 'ID'>>(
    options: Omit<
      MaybeSubscriptionFieldOptions<Types, ParentType, 'ID', Nullable, Args, Subscription>,
      'type'
    >,
  ): Field<Args, Types, ParentType, 'ID', Nullable, null> {
    return this.createField<Args, 'ID', Nullable, null>({ ...options, type: 'ID' }, null);
  }

  int<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, 'Int'>>(
    options: Omit<
      MaybeSubscriptionFieldOptions<Types, ParentType, 'Int', Nullable, Args, Subscription>,
      'type'
    >,
  ): Field<Args, Types, ParentType, 'Int', Nullable, null> {
    return this.createField<Args, 'Int', Nullable, null>({ ...options, type: 'Int' }, null);
  }

  string<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, 'String'>>(
    options: Omit<
      MaybeSubscriptionFieldOptions<Types, ParentType, 'String', Nullable, Args, Subscription>,
      'type'
    >,
  ): Field<Args, Types, ParentType, 'String', Nullable, null> {
    return this.createField<Args, 'String', Nullable, null>({ ...options, type: 'String' }, null);
  }

  booleanList<
    Args extends InputFields<Types>,
    Nullable extends FieldNullability<Types, ['Boolean']>
  >(
    options: Omit<
      MaybeSubscriptionFieldOptions<Types, ParentType, ['Boolean'], Nullable, Args, Subscription>,
      'type'
    >,
  ): Field<Args, Types, ParentType, ['Boolean'], Nullable, null> {
    return this.createField<Args, ['Boolean'], Nullable, null>(
      { ...options, type: ['Boolean'] },
      null,
    );
  }

  floatList<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, ['Float']>>(
    options: Omit<
      MaybeSubscriptionFieldOptions<Types, ParentType, ['Float'], Nullable, Args, Subscription>,
      'type'
    >,
  ): Field<Args, Types, ParentType, ['Float'], Nullable, null> {
    return this.createField<Args, ['Float'], Nullable, null>({ ...options, type: ['Float'] }, null);
  }

  idList<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, ['ID']>>(
    options: Omit<
      MaybeSubscriptionFieldOptions<Types, ParentType, ['ID'], Nullable, Args, Subscription>,
      'type'
    >,
  ): Field<Args, Types, ParentType, ['ID'], Nullable, null> {
    return this.createField<Args, ['ID'], Nullable, null>({ ...options, type: ['ID'] }, null);
  }

  intList<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, ['Int']>>(
    options: Omit<
      MaybeSubscriptionFieldOptions<Types, ParentType, ['Int'], Nullable, Args, Subscription>,
      'type'
    >,
  ): Field<Args, Types, ParentType, ['Int'], Nullable, null> {
    return this.createField<Args, ['Int'], Nullable, null>({ ...options, type: ['Int'] }, null);
  }

  stringList<Args extends InputFields<Types>, Nullable extends FieldNullability<Types, ['String']>>(
    options: Omit<
      MaybeSubscriptionFieldOptions<Types, ParentType, ['String'], Nullable, Args, Subscription>,
      'type'
    >,
  ): Field<Args, Types, ParentType, ['String'], Nullable, null> {
    return this.createField<Args, ['String'], Nullable, null>(
      { ...options, type: ['String'] },
      null,
    );
  }

  field<Args extends InputFields<Types>, Type extends TypeParam<Types>, Req extends boolean>(
    options: MaybeSubscriptionFieldOptions<Types, ParentType, Type, Req, Args, Subscription>,
  ): Field<Args, Types, ParentType, Type, Req, null> {
    return this.createField(options, null);
  }
}
