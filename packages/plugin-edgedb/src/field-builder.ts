import { FieldKind, ObjectRef, RootFieldBuilder, SchemaTypes } from '@pothos/core';
import { GraphQLResolveInfo } from 'graphql';
import { getRefFromModel } from './util/datamodel';

export * from './edgedb-field-builder';

const fieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

fieldBuilderProto.edgeDBField = function edgeDBField({ type, resolve, ...options }) {
  const modelOrRef = Array.isArray(type) ? type[0] : type;
  const typeRef =
    typeof modelOrRef === 'string'
      ? getRefFromModel(modelOrRef, this.builder)
      : (modelOrRef as ObjectRef<unknown>);
  const typeParam = Array.isArray(type) ? ([typeRef] as [ObjectRef<unknown>]) : typeRef;

  return this.field({
    ...(options as {}),
    type: typeParam,
    resolve: (parent: unknown, args: unknown, ctx: {}, info: GraphQLResolveInfo) => {
      const query = null;

      return resolve(query as never, parent as never, args as never, ctx, info) as never;
    },
  }) as never;
};
