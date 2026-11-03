import type {
  CheckAsyncSelection,
  InferredFieldOptionKeys,
  InputFieldMap,
  InputShapeFromFields,
  MaybeAsyncSelection,
  SchemaTypes,
} from '@pothos/core';
import type { ExtractAggregateTypes } from '@prisma/orm-family-sql/contract/types';
import type { ShorthandWhereFilter } from '@prisma/orm-family-sql/orm-client';
import type {
  BareModelName,
  ModelKey,
  NamespaceOf,
  ObjectBaseShape,
  RelationKeys,
} from './models.js';
import type { RelatedModel, RelationWhere } from './relations.js';

/**
 * A count's `where`: a shorthand filter, or a callback of the args and context returning one or the
 * ORM's predicate callback, like the callback form of a relation's `query`.
 */
type RelationCountWhere<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
  Args extends InputFieldMap,
> =
  | ShorthandWhereFilter<
      Types['PrismaNextContract'],
      NamespaceOf<Types['PrismaNextContract'], RelatedModel<Types, M, R>>,
      BareModelName<RelatedModel<Types, M, R>>
    >
  | ((
      args: InputShapeFromFields<Args>,
      context: Types['Context'],
    ) => MaybeAsyncSelection<Types, RelationWhere<Types, RelatedModel<Types, M, R>> | undefined>);

/**
 * What a count's `where` is inferred within. Without `AsyncSelections`, an async callback is
 * accepted here so that `CheckAsyncSelection` names what it needs.
 */
export type RelationCountWhereParam<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
  Args extends InputFieldMap,
> =
  | RelationCountWhere<Types, M, R, Args>
  | (true extends Types['AsyncSelections']
      ? never
      : (args: InputShapeFromFields<Args>, context: Types['Context']) => PromiseLike<unknown>);

type CountWhereCallbackMessage =
  "A count's where callback takes (args, ctx) and returns a where filter or the ORM's predicate, such as () => (c) => c.body.eq('x')";

/**
 * `any`, including the `any` a type error inside the callback leaves. Only `any` extends both a
 * promise and a number; `0 extends 1 & Result` misses that error type on TypeScript 7.
 */
type IsAnyResult<Result> = [Result] extends [never]
  ? false
  : [Result] extends [PromiseLike<unknown> & 0]
    ? true
    : false;

/**
 * A callback that returns `any`, such as the ORM's predicate `(c) => c.body.eq('x')` passed
 * directly, whose `c` is the field's args, would otherwise be reported as async. Without
 * `AsyncSelections`, `CheckAsyncSelection` rejects an `any` result either way, so this changes only
 * the message.
 */
type RelationCountWhereCheck<
  Types extends SchemaTypes,
  Where,
> = true extends Types['AsyncSelections']
  ? unknown
  : [Where] extends [(...args: never[]) => infer Result]
    ? IsAnyResult<Result> extends true
      ? CountWhereCallbackMessage
      : CheckAsyncSelection<Types, Where>
    : CheckAsyncSelection<Types, Where>;

export type PrismaNextRelationCountOptions<
  Types extends SchemaTypes,
  ParentModel extends ModelKey<Types>,
  RelName extends RelationKeys<Types, ParentModel>,
  Args extends InputFieldMap,
  ParentShape = ObjectBaseShape<Types, ParentModel>,
  Where = RelationCountWhereParam<Types, ParentModel, RelName, Args>,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<Types, ParentShape, 'Int', false, Args, number>,
  'type' | 'resolve' | 'select' | 'nullable' | InferredFieldOptionKeys
> & {
  // A callback whose parameters need their types isn't inferred, so `Where` is the whole union, which
  // is checked as the `where` it allows.
  where?: [RelationCountWhereParam<Types, ParentModel, RelName, Args>] extends [Where]
    ? NoInfer<RelationCountWhere<Types, ParentModel, RelName, Args>>
    : Where & RelationCountWhereCheck<Types, Where>;
  /** A count is never null. */
  nullable?: false;
};

/** Whether the target has aggregate operations. MySQL contracts emit `Record<string, never>`. */
export type HasAggregates<Types extends SchemaTypes> = string extends keyof ExtractAggregateTypes<
  Types['PrismaNextContract']
>
  ? false
  : true;

/** `totalCount: true` runs a count aggregate, so it needs a target that has them. */
export type TotalCountFlag<Types extends SchemaTypes> =
  HasAggregates<Types> extends true ? boolean : false | (true & TotalCountNeedsAggregates);

/**
 * Names the problem with `totalCount: true` on a target without aggregates, as
 * `true & TotalCountNeedsAggregates`. No written value matches it, and it stays a `boolean`.
 */
interface TotalCountNeedsAggregates {
  readonly 'totalCount: true runs a count aggregate, which this target (MySQL) lacks. Pass a callback': never;
}
