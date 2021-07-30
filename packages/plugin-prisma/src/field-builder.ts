import { GraphQLResolveInfo } from 'graphql';
import {
  FieldKind,
  FieldNullability,
  FieldRef,
  InputFieldMap,
  NormalizeArgs,
  ObjectFieldBuilder,
  RootFieldBuilder,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';
import { getLoaderMapping, setLoaderMapping } from './loader-map';
import { ModelLoader } from './model-loader';
import { getFindUniqueForRef, getRefFromModel, getRelation } from './refs';
import {
  IncludeFromPrismaDelegate,
  PrismaDelegate,
  RelatedFieldOptions,
  RelationShape,
  ShapeFromPrismaDelegate,
} from './types';
import { includesFromInfo } from './util';

const fieldBuilderProto = RootFieldBuilder.prototype as GiraphQLSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

fieldBuilderProto.prismaField = function prismaField({ type, resolve, ...options }) {
  const modelName: string = Array.isArray(type) ? type[0] : type;
  const typeRef = getRefFromModel(modelName, this.builder);
  const typeParam: TypeParam<SchemaTypes> = Array.isArray(type) ? [typeRef] : typeRef;

  return this.field({
    ...options,
    type: typeParam,
    resolve: (parent: unknown, args: unknown, ctx: {}, info: GraphQLResolveInfo) => {
      const { includes, mappings } = includesFromInfo(info);

      if (mappings) {
        setLoaderMapping(ctx, info.path, mappings);
      }

      return resolve({ include: includes as never }, parent, args as never, ctx, info) as never;
    },
  }) as never;
};

export class PrismaObjectFieldBuilder<
  Types extends SchemaTypes,
  Type extends PrismaDelegate,
  NeedsResolve extends boolean,
> extends ObjectFieldBuilder<Types, ShapeFromPrismaDelegate<Type>> {
  model: string;

  constructor(name: string, builder: GiraphQLSchemaTypes.SchemaBuilder<Types>, model: string) {
    super(name, builder);

    this.model = model;
  }
  relation<
    Field extends string & keyof IncludeFromPrismaDelegate<Type>,
    Nullable extends FieldNullability<Type>,
    Args extends InputFieldMap,
    ResolveReturnShape,
  >(
    ...allArgs: NormalizeArgs<
      [
        name: Field,
        options?: RelatedFieldOptions<
          Types,
          Type,
          Field,
          Nullable,
          Args,
          ResolveReturnShape,
          NeedsResolve
        >,
      ]
    >
  ): FieldRef<RelationShape<Type, Field>, 'Object'> {
    const [name, options = {} as never] = allArgs;
    const { client } = this.builder.options.prisma;
    const relationField = getRelation(client, this.model, name);
    const parentRef = getRefFromModel(this.model, this.builder);
    const ref = getRefFromModel(relationField.type, this.builder);
    const findUnique = getFindUniqueForRef(parentRef, this.builder);
    const loaderCache = ModelLoader.forModel(this.model, this.builder);

    const { query = {}, resolve, ...rest } = options;

    return this.field({
      ...rest,
      type: relationField.isList ? [ref] : ref,
      extensions: {
        ...options.extensions,
        giraphQLPrismaQuery: query,
        giraphQLPrismaRelation: name,
      },
      resolve: (parent, args, context, info) => {
        const parentPath =
          typeof info.path.prev?.key === 'number' ? info.path.prev?.prev : info.path.prev;

        const mapping = getLoaderMapping(context, parentPath!)?.[name];

        const loadedValue = (parent as Record<string, unknown>)[name];

        if (
          // if we attempted to load the relation, and its missing it will be null
          // undefined means that the query was not constructed in a way that requested the relation
          loadedValue !== undefined &&
          mapping &&
          info.fieldNodes[0].alias?.value === mapping.alias &&
          info.fieldNodes[0].name.value === mapping.field
        ) {
          if (loadedValue !== null && loadedValue !== undefined) {
            setLoaderMapping(context, info.path, mapping.mappings);
          }

          return loadedValue as never;
        }

        const queryOptions = (typeof query === 'function' ? query(args) : query) as {
          include?: Record<string, unknown>;
        };

        const { includes, mappings } = includesFromInfo(info);

        if (includes) {
          queryOptions.include = includes;
        }

        if (mappings) {
          setLoaderMapping(context, info.path, mappings);
        }

        if (resolve) {
          return resolve(queryOptions as never, parent, args as never, context, info);
        }

        if (!findUnique) {
          throw new Error(`Missing findUnique for Prisma type ${this.model}`);
        }

        return loaderCache(parent).loadRelation(name, queryOptions) as never;
      },
    }) as FieldRef<RelationShape<Type, Field>, 'Object'>;
  }
}
