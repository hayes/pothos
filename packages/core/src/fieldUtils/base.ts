import { defaultFieldResolver } from 'graphql';
import type {
  FieldKind,
  FieldMode,
  FieldNullability,
  FieldOptionsFromKind,
  InputFieldMap,
  OutputType,
} from '../types';
import { SchemaTypes } from '../types';

export class BaseFieldUtil<
  Types extends SchemaTypes,
  ParentShape,
  Kind extends FieldKind,
  Mode extends FieldMode = Types['FieldMode'],
> {
  kind: Kind;

  graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[Kind];

  builder: PothosSchemaTypes.SchemaBuilder<Types>;

  mode: Mode;

  constructor({
    builder,
    kind,
    graphqlKind,
    mode,
  }: {
    builder: PothosSchemaTypes.SchemaBuilder<Types>;
    kind: Kind;
    graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[Kind];
    mode: Mode;
  }) {
    this.builder = builder;
    this.kind = kind;
    this.graphqlKind = graphqlKind;
    this.mode = mode;
  }

  protected createField<
    Type extends OutputType<Types> | [OutputType<Types>],
    Args extends InputFieldMap,
    Nullable extends FieldNullability<Type>,
    ResolveShape,
    ResolveReturnShape,
  >(
    type: Type | null,
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
    return this.builder.createFieldRef(this.mode, this.kind, type ?? undefined, options);
  }

  protected exposeField<
    Type extends OutputType<Types> | [OutputType<Types>],
    Nullable extends FieldNullability<Type>,
    Name extends string & keyof ParentShape,
  >(
    name: Name,
    type: Type | null,
    options: Omit<
      FieldOptionsFromKind<Types, ParentShape, Type, Nullable, {}, Kind, unknown, unknown, Mode>,
      'resolve' | 'type'
    >,
  ) {
    return this.builder.createFieldRef<
      ParentShape,
      Type,
      Nullable,
      {},
      Kind,
      unknown,
      unknown,
      Mode
    >(this.mode, this.kind, type ?? undefined, options as never, (fieldName) => ({
      extensions: {
        pothosExposedField: name,
      },
      resolve:
        fieldName === name
          ? defaultFieldResolver
          : (parent) => (parent as Record<string, never>)[name as string],
    }));
  }
}
