import { GraphQLResolveInfo } from 'graphql';
import {
  CompatibleTypes,
  FieldKind,
  FieldRef,
  InputFieldMap,
  NormalizeArgs,
  RootFieldBuilder,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import { FieldMap } from './util/relation-map';
import { getLink, getRefFromModel } from './util/datamodel';
import { extractTargetTypeName } from './util/target';
import { isMultiLink } from './util/links';
import { EdgeDBModelTypes, RelatedFieldOptions } from './types';

// Workaround for FieldKind not being extended on Builder classes
const RootBuilder: {
  // eslint-disable-next-line @typescript-eslint/prefer-function-type
  new <Types extends SchemaTypes, Shape, Kind extends FieldKind>(
    name: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    kind: FieldKind,
    graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[FieldKind],
  ): PothosSchemaTypes.RootFieldBuilder<Types, Shape, Kind>;
} = RootFieldBuilder as never;

export class EdgeDBObjectFieldBuilder<
  Types extends SchemaTypes,
  Model extends EdgeDBModelTypes,
  Shape extends object = Model['Shape'],
> extends RootBuilder<Types, Shape, 'EdgeDBObject'> {
  model: string;
  edgeDBFieldMap: FieldMap;

  exposeBoolean = this.createExpose('Boolean');
  exposeFloat = this.createExpose('Float');
  exposeInt = this.createExpose('Int');
  exposeID = this.createExpose('ID');
  exposeString = this.createExpose('String');
  exposeBooleanList = this.createExpose(['Boolean']);
  exposeFloatList = this.createExpose(['Float']);
  exposeIntList = this.createExpose(['Int']);
  exposeIDList = this.createExpose(['ID']);
  exposeStringList = this.createExpose(['String']);

  constructor(
    name: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    model: string,
    fieldMap: FieldMap,
  ) {
    super(name, builder, 'EdgeDBObject', 'Object');

    this.model = model;
    this.edgeDBFieldMap = fieldMap;
  }

  link<
    Field extends Model['LinkName'],
    Nullable extends boolean,
    Args extends InputFieldMap,
    ResolveReturnShape,
  >(
    ...allArgs: NormalizeArgs<
      [
        name: Field,
        options?: RelatedFieldOptions<
          Types,
          Model,
          Field,
          Nullable,
          Args,
          ResolveReturnShape,
          Shape
        >,
      ]
    >
  ): FieldRef<Model['Links'][Field]['Shape'], 'Object'> {
    const [name, { ...options } = {} as never] = allArgs;
    const relationField = getLink(this.model, this.builder, name);
    const ref = getRefFromModel(extractTargetTypeName(relationField.target), this.builder);

    const { resolve, extensions, ...rest } = options;

    const isList = isMultiLink(relationField);

    console.log('[debug] link() -> name: ', name);
    console.log('[debug] link() -> relationField: ', relationField, relationField.target);
    console.log('[debug] link() -> ref: ', ref);
    console.log('[debug] link() -> isList: ', isList);

    return this.field({
      ...(rest as {}),
      type: isList ? [ref] : ref,
      // TODO: Descriptions
      // description: getFieldDescription(this.model, this.builder, name, description),
      extensions: {
        ...extensions,
        pothosEdgeDBFallback:
          resolve &&
          ((q: {}, parent: Shape, args: {}, context: {}, info: GraphQLResolveInfo) =>
            resolve({ ...q } as never, parent, args as never, context, info)),
      },
      resolve: (parent) => (parent as Record<string, never>)[name],
    }) as FieldRef<Model['Links'][Field]['Shape'], 'Object'>;
  }

  expose<
    Type extends TypeParam<Types>,
    Nullable extends boolean,
    ResolveReturnShape,
    Name extends CompatibleTypes<Types, Shape, Type, Nullable>,
  >(
    ...args: NormalizeArgs<
      [
        name: Name,
        options?: Omit<
          PothosSchemaTypes.ObjectFieldOptions<
            Types,
            Shape,
            Type,
            Nullable,
            {},
            ResolveReturnShape
          >,
          'resolve' | 'select'
        >,
      ]
    >
  ) {
    const [name, options = {} as never] = args;

    const typeConfig = this.builder.configStore.getTypeConfig(this.typename, 'Object');
    const usingSelect = false;

    return this.exposeField(name as never, {
      ...options,
    });
  }

  private createExpose<Type extends TypeParam<Types>>(type: Type) {
    return <
      Nullable extends boolean,
      ResolveReturnShape,
      Name extends CompatibleTypes<Types, Shape, Type, Nullable>,
    >(
      ...args: NormalizeArgs<
        [
          name: Name,
          options?: Omit<
            PothosSchemaTypes.ObjectFieldOptions<
              Types,
              Shape,
              Type,
              Nullable,
              {},
              ResolveReturnShape
            >,
            'resolve' | 'type' | 'select' | 'description'
          > & { description?: string | false },
        ]
      >
    ): FieldRef<ShapeFromTypeParam<Types, Type, Nullable>, 'EdgeDBObject'> => {
      const [name, { description, ...options } = {} as never] = args;

      return this.expose(name as never, {
        ...options,
        // TODO: Descriptions
        // description: getFieldDescription(
        //   this.model,
        //   this.builder,
        //   name as string,
        //   description,
        // ) as never,
        type,
      });
    };
  }
}
