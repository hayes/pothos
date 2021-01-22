/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { TypeParam, CompatibleTypes, FieldNullability, SchemaTypes } from '../types';
import {
  ShapeFromTypeParam,
  InputFieldMap,
  FieldKind,
  FieldRef,
  GiraphQLInputFieldConfig,
} from '..';
import { typeFromParam } from '../utils';

export default class BaseFieldUtil<Types extends SchemaTypes, ParentShape, Kind extends FieldKind> {
  typename: string;

  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;

  kind: Kind;

  graphqlKind: GiraphQLSchemaTypes.GiraphQLKindToGraphQLType[Kind];

  constructor(
    name: string,
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
    kind: Kind,
    graphqlKind: GiraphQLSchemaTypes.GiraphQLKindToGraphQLType[Kind],
  ) {
    this.typename = name;
    this.builder = builder;
    this.kind = kind;
    this.graphqlKind = graphqlKind;
  }

  protected createField<
    Args extends InputFieldMap,
    Type extends TypeParam<Types>,
    Nullable extends FieldNullability<Type>
  >(
    options: GiraphQLSchemaTypes.FieldOptions<Types, ParentShape, Type, Nullable, Args, any, {}>,
  ): FieldRef<ShapeFromTypeParam<Types, Type, Nullable>, Kind> {
    const ref: FieldRef<ShapeFromTypeParam<Types, Type, Nullable>, Kind> = new FieldRef(
      this.kind,
      this.typename,
    );

    this.builder.configStore.addFieldRef(ref, options.type, options.args || {}, (name) => {
      const args: { [name: string]: GiraphQLInputFieldConfig<Types> } = {};

      if (options.args) {
        Object.keys(options.args).forEach((name) => {
          const ref = options.args![name];

          args[name] = this.builder.configStore.createFieldConfig(ref, name, 'Arg');
        });
      }

      return {
        kind: this.kind as any,
        graphqlKind: this.graphqlKind as GiraphQLSchemaTypes.GiraphQLKindToGraphQLType[FieldKind],
        parentType: this.typename,
        name,
        args,
        type: typeFromParam(
          options.type,
          this.builder.configStore,
          options.nullable ?? this.builder.defaultFieldNullability,
        ),
        giraphqlOptions: options as any,
        description: options.description,
        resolve:
          (options as { resolve?: (...argList: unknown[]) => unknown }).resolve ??
          (() => {
            throw new Error(`Not implemented: No resolver found for ${this.typename}.${name}`);
          }),
        subscribe: (options as { subscribe?: (...argList: unknown[]) => unknown }).subscribe,
      };
    });

    return ref;
  }

  protected exposeField<
    Type extends TypeParam<Types>,
    Nullable extends FieldNullability<Type>,
    Name extends CompatibleTypes<Types, ParentShape, Type, Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, Type, Nullable, {}, {}>,
      'resolve'
    >,
  ): FieldRef<ShapeFromTypeParam<Types, Type, Nullable>, Kind> {
    return this.createField({
      ...options,
      resolve: (parent) => (parent as { [s: string]: any })[name as string],
    });
  }
}
