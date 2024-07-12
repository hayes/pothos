import { GraphQLResolveInfo } from 'graphql';
import { FieldKind, ObjectRef, RootFieldBuilder, SchemaTypes } from '@pothos/core';
import { queryFromInfo } from './utils/map-query';
import { getRefFromModel } from './utils/refs';

const fieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

fieldBuilderProto.drizzleField = function drizzleField({ type, resolve, ...options }) {
  const modelOrRef = Array.isArray(type) ? type[0] : type;
  const typeRef =
    // typeof modelOrRef === 'string' ?
    getRefFromModel(modelOrRef as string, this.builder);
  // : (modelOrRef as ObjectRef<SchemaTypes, unknown>);
  const typeParam = Array.isArray(type)
    ? ([typeRef] as [ObjectRef<SchemaTypes, unknown>])
    : typeRef;
  return this.field({
    ...(options as {}),
    type: typeParam,
    resolve: (parent: unknown, args: unknown, context: {}, info: GraphQLResolveInfo) => {
      const query = queryFromInfo({
        schema: this.builder.options.drizzle.client._.schema!,
        context,
        info,
        // withUsageCheck: !!this.builder.options.drizzle?.onUnusedQuery,
      });

      return resolve(query, parent, args as never, context, info) as never;
    },
  }) as never;
};
