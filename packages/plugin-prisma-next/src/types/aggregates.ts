import type {
  InferredFieldOptionKeys,
  InputFieldMap,
  InputShapeFromFields,
  MaybeAsyncSelection,
  SchemaTypes,
} from '@pothos/core';
import type { ExtractAggregateTypes } from '@prisma/orm-family-sql/contract/types';
import type { ModelKey, ObjectBaseShape, RelationKeys } from './models.js';
import type { ExactQuery, QueryAsyncCheck, RelatedModel, RelationWhere } from './relations.js';

/** The literal `query` of a count: a `where`, as a shorthand filter or the ORM's predicate. */
export interface RelationCountQueryLiteral<Types extends SchemaTypes, M extends ModelKey<Types>> {
  where?: RelationWhere<Types, M>;
}

/** A count's `query`: the literal, or a callback of the args and context returning it. */
export type RelationCountQuery<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
  Args extends InputFieldMap,
> =
  | RelationCountQueryLiteral<Types, RelatedModel<Types, M, R>>
  | ((
      args: InputShapeFromFields<Args>,
      context: Types['Context'],
    ) => MaybeAsyncSelection<
      Types,
      RelationCountQueryLiteral<Types, RelatedModel<Types, M, R>> | undefined
    >);

export type PrismaNextRelationCountOptions<
  Types extends SchemaTypes,
  ParentModel extends ModelKey<Types>,
  RelName extends RelationKeys<Types, ParentModel>,
  Args extends InputFieldMap,
  ParentShape = ObjectBaseShape<Types, ParentModel>,
  Query = RelationCountQuery<Types, ParentModel, RelName, Args>,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<Types, ParentShape, 'Int', false, Args, number>,
  'type' | 'resolve' | 'select' | 'nullable' | InferredFieldOptionKeys
> & {
  query?: Query &
    QueryAsyncCheck<Types, Query> &
    NoInfer<ExactQuery<Types, RelatedModel<Types, ParentModel, RelName>, Query, 'where'>>;
  /** A count is never null. */
  nullable?: false;
};

/** Whether the target has aggregate operations. MySQL contracts emit `Record<string, never>`. */
export type HasAggregates<Types extends SchemaTypes> = string extends keyof ExtractAggregateTypes<
  Types['PrismaNextContract']
>
  ? false
  : true;

/** The name `relationCount` takes: a to-many relation, on a target that has aggregates. */
export type CountedRelationName<Types extends SchemaTypes, RelName> =
  HasAggregates<Types> extends true ? RelName : never;

/** `totalCount: true` runs a count aggregate, so it needs a target that has them. */
export type TotalCountFlag<Types extends SchemaTypes> =
  HasAggregates<Types> extends true ? boolean : false;
