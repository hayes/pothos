import { ListRef } from '../refs/list';
import { NonNullRef } from '../refs/non-null';
import type {
  ArgBuilder,
  FieldMode,
  InputFieldMap,
  InputType,
  NormalizeArgs,
  OutputType,
} from '../types';
import { FieldKind, FieldNullability, FieldOptionsFromKind, SchemaTypes } from '../types';
import { nonNullableFromOptions } from '../utils';
import { BaseFieldUtil } from './base';
import { InputFieldBuilder } from './input';

export class RootFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
  Kind extends FieldKind = FieldKind,
  Mode extends FieldMode = Types['FieldMode'],
> extends BaseFieldUtil<Types, ParentShape, Kind, Mode> {
  arg: ArgBuilder<Types> = new InputFieldBuilder<Types, 'Arg'>(this.builder, 'Arg').argBuilder();

  /**
   * Create a Boolean field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  boolean<
    Args extends InputFieldMap,
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<'Boolean'> = Types['DefaultFieldNullability'],
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
            ResolveReturnShape,
            Mode
          >,
          'type'
        >,
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<'Boolean', Args, Nullable, ResolveShape, ResolveReturnShape>(
      'Boolean',
      options as never,
    );
  }

  /**
   * Create a Float field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  float<
    Args extends InputFieldMap,
    Nullable extends FieldNullability<'Float'>,
    ResolveShape,
    ResolveReturnShape,
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
            ResolveReturnShape,
            Mode
          >,
          'type'
        >,
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<'Float', Args, Nullable, ResolveShape, ResolveReturnShape>(
      'Float',
      options as never,
    );
  }

  /**
   * Create a ID field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  id<
    Args extends InputFieldMap,
    Nullable extends FieldNullability<'ID'>,
    ResolveShape,
    ResolveReturnShape,
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
            ResolveReturnShape,
            Mode
          >,
          'type'
        >,
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<'ID', Args, Nullable, ResolveShape, ResolveReturnShape>(
      'ID',
      options as never,
    );
  }

  /**
   * Create a Int field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  int<
    Args extends InputFieldMap,
    Nullable extends FieldNullability<'Int'>,
    ResolveShape,
    ResolveReturnShape,
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
            ResolveReturnShape,
            Mode
          >,
          'type'
        >,
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<'Int', Args, Nullable, ResolveShape, ResolveReturnShape>(
      'Int',
      options as never,
    );
  }

  /**
   * Create a String field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  string<
    Args extends InputFieldMap,
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<'String'> = Types['DefaultFieldNullability'],
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
            ResolveReturnShape,
            Mode
          >,
          'type'
        >,
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<'String', Args, Nullable, ResolveShape, ResolveReturnShape>(
      'String',
      options as never,
    );
  }

  /**
   * Create a Boolean list field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  booleanList<
    Args extends InputFieldMap,
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<['Boolean']> = Types['DefaultFieldNullability'],
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
            ResolveReturnShape,
            Mode
          >,
          'type'
        >,
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<['Boolean'], Args, Nullable, ResolveShape, ResolveReturnShape>(
      ['Boolean'],
      options as never,
    );
  }

  /**
   * Create a Float list field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  floatList<
    Args extends InputFieldMap,
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<['Float']> = Types['DefaultFieldNullability'],
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
            ResolveReturnShape,
            Mode
          >,
          'type'
        >,
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<['Float'], Args, Nullable, ResolveShape, ResolveReturnShape>(
      ['Float'],
      options as never,
    );
  }

  /**
   * Create a ID list field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  idList<
    Args extends InputFieldMap,
    Nullable extends FieldNullability<['ID']>,
    ResolveShape,
    ResolveReturnShape,
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
            ResolveReturnShape,
            Mode
          >,
          'type'
        >,
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<['ID'], Args, Nullable, ResolveShape, ResolveReturnShape>(
      ['ID'],
      options as never,
    );
  }

  /**
   * Create a Int list field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  intList<
    Args extends InputFieldMap,
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<['Int']> = Types['DefaultFieldNullability'],
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
            ResolveReturnShape,
            Mode
          >,
          'type'
        >,
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<['Int'], Args, Nullable, ResolveShape, ResolveReturnShape>(
      ['Int'],
      options as never,
    );
  }

  /**
   * Create a String list field
   * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
   */
  stringList<
    Args extends InputFieldMap,
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<['String']> = Types['DefaultFieldNullability'],
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
            ResolveReturnShape,
            Mode
          >,
          'type'
        >,
      ]
    >
  ) {
    const [options = {} as never] = args;

    return this.createField<['String'], Args, Nullable, ResolveShape, ResolveReturnShape>(
      ['String'],
      options as never,
    );
  }

  /**
   * create a new field for the current type
   * @param {PothosSchemaTypes.FieldOptions} options - options for this field
   */
  field<
    Args extends InputFieldMap,
    Type extends OutputType<Types> | [OutputType<Types>],
    ResolveShape,
    ResolveReturnShape,
    Nullable extends FieldNullability<Type> = Types['DefaultFieldNullability'],
  >(
    options: FieldOptionsFromKind<
      Types,
      ParentShape,
      Type,
      Nullable,
      Args,
      Kind,
      ResolveShape,
      ResolveReturnShape,
      Mode
    >,
  ) {
    return this.createField<Type, Args, Nullable, ResolveShape, ResolveReturnShape>(
      null,
      options as never,
    );
  }

  listRef<T extends OutputType<Types>, Nullable extends boolean = false>(
    type: T,
    { nullable = false as Nullable }: { nullable?: Nullable } = {},
  ) {
    const nonNull = nonNullableFromOptions(this.builder, { nullable });
    const ref = nonNull ? new NonNullRef<Types, T>(type) : type;

    return new ListRef<Types, typeof ref>(ref) as Nullable extends true
      ? ListRef<Types, T>
      : ListRef<Types, NonNullRef<Types, T>>;
  }

  list<T extends InputType<Types> | OutputType<Types>>(type: T) {
    return new ListRef<Types, T>(type);
  }

  nonNull<T extends InputType<Types> | OutputType<Types>>(type: T) {
    return new NonNullRef<Types, T>(type);
  }
}
