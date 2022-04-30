import { defaultFieldResolver } from 'graphql';
import FieldRef from '../refs/field';
import type {
  FieldKind,
  InputFieldMap,
  PothosInputFieldConfig,
  ShapeFromTypeParam,
} from '../types';
import { CompatibleTypes, FieldNullability, SchemaTypes, TypeParam } from '../types';
import { typeFromParam } from '../utils';

export default class BaseFieldUtil<Types extends SchemaTypes, ParentShape, Kind extends FieldKind> {
  typename: string;

  builder: PothosSchemaTypes.SchemaBuilder<Types>;

  kind: Kind;

  graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[Kind];

  constructor(
    name: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    kind: Kind,
    graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[Kind],
  ) {
    this.typename = name;
    this.builder = builder;
    this.kind = kind;
    this.graphqlKind = graphqlKind;
  }

  protected createField<
    Args extends InputFieldMap,
    Type extends TypeParam<Types>,
    Nullable extends FieldNullability<Type>,
  >(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: PothosSchemaTypes.FieldOptions<Types, ParentShape, Type, Nullable, Args, any, {}>,
  ): FieldRef<ShapeFromTypeParam<Types, Type, Nullable>, Kind> {
    const ref: FieldRef<ShapeFromTypeParam<Types, Type, Nullable>, Kind> = new FieldRef(
      this.kind,
      this.typename,
    );

    this.builder.configStore.addFieldRef(
      ref,
      options.type,
      options.args ?? {},
      (name, parentField, typeConfig) => {
        const args: Record<string, PothosInputFieldConfig<Types>> = {};

        if (options.args) {
          Object.keys(options.args).forEach((argName) => {
            const argRef = options.args![argName];

            args[argName] = this.builder.configStore.createFieldConfig(
              argRef,
              argName,
              typeConfig,
              name,
              'Arg',
            );
          });
        }

        let resolve =
          (options as { resolve?: (...argList: unknown[]) => unknown }).resolve ??
          (() => {
            throw new Error(`Not implemented: No resolver found for ${this.typename}.${name}`);
          });

        if (options.extensions?.pothosExposedField === name) {
          resolve = defaultFieldResolver as typeof resolve;
        }

        const { subscribe } = options as { subscribe?: (...argList: unknown[]) => unknown };

        return {
          kind: this.kind as never,
          graphqlKind: this.graphqlKind,
          parentType: typeConfig.name,
          name,
          args,
          type: typeFromParam(
            options.type,
            this.builder.configStore,
            options.nullable ?? this.builder.defaultFieldNullability,
          ),
          pothosOptions: options as never,
          extensions: {
            pothosOriginalResolve: resolve,
            pothosOriginalSubscribe: subscribe,
            ...options.extensions,
          },
          description: options.description,
          deprecationReason: options.deprecationReason,
          resolve,
          subscribe,
        };
      },
    );

    return ref;
  }

  protected exposeField<
    Type extends TypeParam<Types>,
    Nullable extends FieldNullability<Type>,
    Name extends CompatibleTypes<Types, ParentShape, Type, Nullable>,
  >(
    name: Name,
    {
      extensions,
      ...options
    }: Omit<
      PothosSchemaTypes.ObjectFieldOptions<Types, ParentShape, Type, Nullable, {}, {}>,
      'resolve'
    >,
  ): FieldRef<ShapeFromTypeParam<Types, Type, Nullable>, Kind> {
    return this.createField({
      ...options,
      extensions: {
        pothosExposedField: name,
        ...extensions,
      },
      resolve: (parent) => (parent as Record<string, never>)[name as string],
    });
  }
}
