import { ListRef } from '../refs/list';
import type { ArgBuilder, InputFieldMap, NormalizeArgs, ShapeFromTypeParam } from '../types';
import type {
  FieldKind,
  FieldNullability,
  FieldOptionsFromKind,
  SchemaTypes,
  TypeParam,
} from '../types';
import { BaseFieldUtil } from './base';
import { InputFieldBuilder } from './input';

export class RootFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
  Kind extends FieldKind = FieldKind,
> extends BaseFieldUtil<Types, ParentShape, Kind> {
  arg: ArgBuilder<Types> = new InputFieldBuilder<Types, 'Arg'>(this.builder, 'Arg').argBuilder();

  /**
   * Create a Boolean field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  boolean<
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<'Boolean'> = Types['DefaultFieldNullability'],
    Args extends InputFieldMap = {},
  >(
    ...args: NormalizeArgs<
      [
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
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<'Boolean', Nullable, Args>({
      resolve: undefined as never,
      ...options,
      type: 'Boolean',
    });
  }

  /**
   * Create a Float field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  float<
    Nullable extends FieldNullability<'Float'>,
    ResolveShape,
    ResolveReturnShape,
    Args extends InputFieldMap = {},
  >(
    ...args: NormalizeArgs<
      [
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
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<'Float', Nullable, Args>({
      resolve: undefined as never,
      ...options,
      type: 'Float',
    });
  }

  /**
   * Create a ID field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  id<
    Nullable extends FieldNullability<'ID'>,
    ResolveShape,
    ResolveReturnShape,
    Args extends InputFieldMap = {},
  >(
    ...args: NormalizeArgs<
      [
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
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<'ID', Nullable, Args>({
      resolve: undefined as never,
      ...options,
      type: 'ID',
    });
  }

  /**
   * Create a Int field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  int<
    Nullable extends FieldNullability<'Int'>,
    ResolveShape,
    ResolveReturnShape,
    Args extends InputFieldMap = {},
  >(
    ...args: NormalizeArgs<
      [
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
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<'Int', Nullable, Args>({
      resolve: undefined as never,
      ...options,
      type: 'Int',
    });
  }

  /**
   * Create a String field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  string<
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<'String'> = Types['DefaultFieldNullability'],
    Args extends InputFieldMap = {},
  >(
    ...args: NormalizeArgs<
      [
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
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<'String', Nullable, Args>({
      resolve: undefined as never,
      ...options,
      type: 'String',
    });
  }

  /**
   * Create a Boolean list field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  booleanList<
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<['Boolean']> = Types['DefaultFieldNullability'],
    Args extends InputFieldMap = {},
  >(
    ...args: NormalizeArgs<
      [
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
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<['Boolean'], Nullable, Args>({
      resolve: undefined as never,
      ...options,
      type: ['Boolean'],
    });
  }

  /**
   * Create a Float list field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  floatList<
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<['Float']> = Types['DefaultFieldNullability'],
    Args extends InputFieldMap = {},
  >(
    ...args: NormalizeArgs<
      [
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
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<['Float'], Nullable, Args>({
      resolve: undefined as never,
      ...options,
      type: ['Float'],
    });
  }

  /**
   * Create a ID list field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  idList<
    Nullable extends FieldNullability<['ID']>,
    ResolveShape,
    ResolveReturnShape,
    Args extends InputFieldMap = {},
  >(
    ...args: NormalizeArgs<
      [
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
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<['ID'], Nullable, Args>({
      resolve: undefined as never,
      ...options,
      type: ['ID'],
    });
  }

  /**
   * Create a Int list field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  intList<
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<['Int']> = Types['DefaultFieldNullability'],
    Args extends InputFieldMap = {},
  >(
    ...args: NormalizeArgs<
      [
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
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<['Int'], Nullable, Args>({
      resolve: undefined as never,
      ...options,
      type: ['Int'],
    });
  }

  /**
   * Create a String list field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  stringList<
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<['String']> = Types['DefaultFieldNullability'],
    Args extends InputFieldMap = {},
  >(
    ...args: NormalizeArgs<
      [
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
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<['String'], Nullable, Args>({
      resolve: undefined as never,
      ...options,
      type: ['String'],
    });
  }

  /**
   * create a new field for the current type
   * @param {PothosSchemaTypes.FieldOptions} options - options for this field
   */
  field<
    Type extends TypeParam<Types>,
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<Type> = Types['DefaultFieldNullability'],
    Args extends InputFieldMap = {},
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
    return this.createField<Type, Nullable, Args>(options as never);
  }

  listRef<T extends TypeParam<Types>, Nullable extends boolean = false>(
    type: T,
    options?: { nullable?: Nullable },
  ): ListRef<Types, ShapeFromTypeParam<Types, T, Nullable>[]> {
    return new ListRef<Types, ShapeFromTypeParam<Types, T, Nullable>[]>(
      type,
      options?.nullable ?? false,
    );
  }
}
