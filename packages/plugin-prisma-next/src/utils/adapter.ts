import { completeValue, PothosValidationError } from '@pothos/core';
import {
  type Node,
  NodeAdapter,
  type Plan,
  type QueryVisitor,
  type WalkedType,
} from '@pothos/selection-mapper';
import type { GraphQLField, GraphQLNamedType } from 'graphql';
import { PRISMA_NEXT_FIELD_SELECT, PRISMA_NEXT_MODEL, PRISMA_NEXT_SELECT } from '../constants.js';
import type { AnyContract } from '../types.js';
import {
  getIdentityFields,
  getModel,
  type PrismaNextModel,
  type PrismaNextRelation,
} from './model.js';
import {
  COMPUTE,
  type ComputedSelection,
  compileTypeSelect,
  type Narrowing,
  type PrismaNextQuery,
  type PrismaNextSelectFn,
  type RawSelect,
  REFINE,
  type RelationArgs,
  relationName,
  SLOT,
} from './selections.js';

/**
 * Loose shape of orm-client's `Collection`: the typed one collapses `.select(name)` to
 * `keyof never` when the model is only known at runtime.
 */
export interface MapperCollection {
  select(...fields: string[]): MapperCollection;
  include(name: string, refine?: (rel: MapperCollection) => unknown): MapperCollection;
  combine(spec: Record<string, unknown>): MapperCollection;
  where(input: unknown): MapperCollection;
  orderBy(input: unknown): MapperCollection;
  limit(n: number): MapperCollection;
  offset(n: number): MapperCollection;
  variant(value: string): MapperCollection;
  readonly state?: { readonly variantValue?: unknown };
}

export type PrismaNextNode = Node<PrismaNextModel>;
export type PrismaNextPlan = Plan<PrismaNextModel, PrismaNextQuery>;

const EMPTY: PrismaNextQuery = Object.freeze({});

export function relationOf(model: PrismaNextModel, name: string): PrismaNextRelation {
  const relation = model.relations[name];
  if (!relation) {
    throw new PothosValidationError(`Relation "${name}" does not exist on model ${model.name}`);
  }
  return relation;
}

type Visitor = QueryVisitor<PrismaNextModel, PrismaNextQuery>;

/**
 * How Prisma Next selections read onto the shared node tree, and how a node becomes collection
 * calls. Merge, compare and conflict rules are `NodeAdapter`'s; to-many consumers never conflict
 * because each scope has its own slot.
 */
export class PrismaNextAdapter extends NodeAdapter<PrismaNextModel, PrismaNextQuery> {
  override readonly skipDeferredFragments: boolean;
  private readonly typeSelections = new WeakMap<
    GraphQLNamedType,
    { query?: PrismaNextQuery; deferred: Map<string, PrismaNextQuery> }
  >();
  private readonly fieldSelections = new WeakMap<
    GraphQLField<unknown, unknown>,
    PrismaNextQuery | PrismaNextSelectFn | null
  >();

  constructor(
    readonly contract: AnyContract,
    skipDeferredFragments: boolean,
  ) {
    super();
    this.skipDeferredFragments = skipDeferredFragments;
  }

  modelFor(type: GraphQLNamedType): PrismaNextModel | undefined {
    const name = type.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    return name === undefined ? undefined : getModel(this.contract, name);
  }

  /**
   * The type's own selection, then each interface's in turn. An interface selection conflicting
   * with what is already there is planned with the fields that interface declares instead, so
   * those fields load separately.
   */
  typeSelection(type: GraphQLNamedType): PrismaNextQuery | undefined {
    return this.typeSelectionOf(type).query;
  }

  /** Interfaces whose `select` conflicts with the type's own, so their fields load separately. */
  conflictingInterfaces(type: GraphQLNamedType): string[] {
    return [...this.typeSelectionOf(type).deferred.keys()];
  }

  private typeSelectionOf(type: GraphQLNamedType) {
    let selection = this.typeSelections.get(type);
    if (!selection) {
      selection = { deferred: new Map() };
      const model = this.modelFor(type);
      if (model) {
        const node = this.createNode(model);
        const visited = new Set<GraphQLNamedType>();
        const visit = (current: GraphQLNamedType) => {
          if (visited.has(current)) {
            return;
          }
          visited.add(current);
          const raw = current.extensions?.[PRISMA_NEXT_SELECT] as RawSelect | undefined;
          const own = raw && compileTypeSelect(raw, model, current.name);
          if (own) {
            if (current === type || this.canMergeQuery(node, own)) {
              this.mergeQuery(node, own);
            } else {
              selection!.deferred.set(current.name, own);
            }
          }
          for (const iface of 'getInterfaces' in current ? current.getInterfaces() : []) {
            visit(iface);
          }
        };
        visit(type);
        this.mergeQuery(node, { columns: getIdentityFields(this.contract, model.name) });
        selection.query = this.toQuery(node);
      }
      this.typeSelections.set(type, selection);
    }
    return selection;
  }

  fieldSelection(field: GraphQLField<unknown, unknown>, type: WalkedType) {
    let selection = this.fieldSelections.get(field);
    if (selection === undefined) {
      selection = this.withPrerequisite(
        field,
        type,
        field.extensions?.[PRISMA_NEXT_FIELD_SELECT] as
          | PrismaNextQuery
          | PrismaNextSelectFn
          | undefined,
      );
      this.fieldSelections.set(field, selection ?? null);
    }
    return selection ?? undefined;
  }

  /** A field declared by an interface whose selection was set aside carries that selection. */
  private withPrerequisite(
    field: GraphQLField<unknown, unknown>,
    type: WalkedType,
    own: PrismaNextQuery | PrismaNextSelectFn | undefined,
  ) {
    const { deferred } = this.typeSelectionOf(type);
    const iface =
      deferred.size > 0 && 'getInterfaces' in type
        ? type.getInterfaces().find((i) => deferred.has(i.name) && i.getFields()[field.name])
        : undefined;
    if (!iface) {
      return own;
    }
    const model = this.modelFor(type)!;
    const prerequisite = deferred.get(iface.name)!;
    const merged = (query: PrismaNextQuery | false | null | undefined) =>
      this.mergedQuery(model, [prerequisite, query || EMPTY]);
    return typeof own === 'function'
      ? (((...args) => completeValue(own(...args), merged)) as PrismaNextSelectFn)
      : merged(own);
  }

  visitQuery(query: PrismaNextQuery, model: PrismaNextModel, visit: Visitor) {
    if (query.columns === null) {
      visit.allColumns();
    } else {
      for (const column of query.columns ?? []) {
        if (model.columns && !model.columns.has(column)) {
          throw new PothosValidationError(
            `select: '${column}' is not a column or relation on ${model.name}. Check for a typo, or register the field via the contract.`,
          );
        }
        visit.column(column);
      }
    }
    for (const key of Object.keys(query.relations ?? {})) {
      visit.relation(key, relationOf(model, relationName(key)).target, query.relations![key]);
    }
    for (const key of Object.keys(query.computed ?? {})) {
      relationOf(model, relationName(key));
      visit.computed(key, query.computed![key], 'relation');
    }
    visit.args(query.args ?? EMPTY);
  }

  /** Relations the ORM can't include on a level are left for the loader. */
  override canMergeQuery(
    node: PrismaNextNode,
    query: PrismaNextQuery,
    options?: Parameters<NodeAdapter<PrismaNextModel, PrismaNextQuery>['canMergeQuery']>[2],
  ): boolean {
    return (
      super.canMergeQuery(node, query, options) &&
      !variantProblem(query, node.model, (node.args as RelationArgs).variant)
    );
  }

  toQuery(node: PrismaNextNode): PrismaNextQuery {
    const query: PrismaNextQuery = { columns: node.columns && [...node.columns], args: node.args };
    if (node.relations.size > 0) {
      query.relations = {};
      for (const [key, child] of node.relations) {
        query.relations[key] = this.toQuery(child);
      }
    }
    if (node.computed.size > 0) {
      query.computed = Object.fromEntries(node.computed) as Record<string, ComputedSelection>;
    }
    return query;
  }

  /** Several selections as one, without conflict checks. */
  private mergedQuery(model: PrismaNextModel, queries: PrismaNextQuery[]): PrismaNextQuery {
    const node = this.createNode(model);
    for (const query of queries) {
      this.mergeQuery(node, query);
    }
    return this.toQuery(node);
  }

  /** `query` applied to `collection`: its columns, then each relation as one include. */
  emit(
    collection: MapperCollection,
    query: PrismaNextQuery,
    model: PrismaNextModel,
    ctx: object,
  ): MapperCollection {
    const problem = variantProblem(query, model, query.args?.variant);
    if (problem) {
      throw new PothosValidationError(problem);
    }
    return this.emitLevel(collection, query, model, ctx);
  }

  private emitLevel(
    collection: MapperCollection,
    query: PrismaNextQuery,
    model: PrismaNextModel,
    ctx: object,
  ): MapperCollection {
    let result = query.columns?.length ? collection.select(...query.columns) : collection;
    const includes = new Map<
      string,
      { rows: [string, PrismaNextQuery][]; computed: [string, ComputedSelection][] }
    >();
    const slotsOf = (key: string) => {
      const name = relationName(key);
      let slots = includes.get(name);
      if (!slots) {
        slots = { rows: [], computed: [] };
        includes.set(name, slots);
      }
      return { scope: key.slice(name.length + 1), slots };
    };
    for (const [key, child] of Object.entries(query.relations ?? {})) {
      const { scope, slots } = slotsOf(key);
      slots.rows.push([scope, child]);
    }
    for (const [key, value] of Object.entries(query.computed ?? {})) {
      const { scope, slots } = slotsOf(key);
      slots.computed.push([scope, value]);
    }
    for (const [name, { rows, computed }] of includes) {
      const relation = relationOf(model, name);
      result = result.include(name, (rel) =>
        this.emitRelation(rel, name, relation, rows, computed, ctx),
      );
    }
    return result;
  }

  private emitRelation(
    rel: MapperCollection,
    name: string,
    relation: PrismaNextRelation,
    rows: [string, PrismaNextQuery][],
    computed: [string, ComputedSelection][],
    ctx: object,
  ) {
    const target = relation.targetVariant;
    // The ORM reads a single-table variant's rows through the base table without filtering them.
    const base = target?.sharesTable
      ? rel.where((row: Record<string, { eq(value: unknown): unknown }>) =>
          row[target.field].eq(target.value),
        )
      : rel;
    const load = (query: PrismaNextQuery) => {
      const narrowing = query.args?.variant;
      const narrowed = narrowing && !narrowing.viaModel ? base.variant(narrowing.value) : base;
      const refined = query.args?.[REFINE]?.(narrowed) ?? narrowed;
      return this.emitLevel(refined, query, relation.target, ctx);
    };
    if (!relation.isToMany) {
      if (computed.length > 0) {
        throw new PothosValidationError(
          `Function-form selection on to-one relation "${name}" requires combine(), which the ORM supports only for to-many relations (ORM.INCLUDE_UNSUPPORTED). ` +
            'Use a relation field with query options or a declarative select instead.',
        );
      }
      return load(rows[0][1]);
    }
    const shared = computed.length === 0 ? this.shareRows(relation.target, rows) : undefined;
    if (shared) {
      return load(shared);
    }
    const slots: Record<string, unknown> = {};
    for (const [scope, query] of rows) {
      slots[scope] = load(query);
    }
    for (const [scope, value] of computed) {
      const values = value[COMPUTE](base, ctx);
      for (const key of Object.keys(values)) {
        slots[`${scope}${SLOT}${key}`] = values[key];
      }
    }
    return base.combine(slots);
  }

  /** Every consumer of a relation as one include, when their queries agree. */
  private shareRows(model: PrismaNextModel, rows: [string, PrismaNextQuery][]) {
    if (rows.length === 1) {
      return rows[0][1];
    }
    const node = this.createNode(model);
    this.mergeQuery(node, rows[0][1]);
    for (const [, query] of rows.slice(1)) {
      if (!this.canMergeQuery(node, query)) {
        return undefined;
      }
      this.mergeQuery(node, query);
    }
    return this.toQuery(node);
  }
}

/**
 * Why the ORM can't include some relation of `query` where it sits: a variant's relation on a
 * level not narrowed to that variant, or a base relation beneath a relation to a variant model.
 */
function variantProblem(
  query: PrismaNextQuery,
  model: PrismaNextModel,
  narrowing: Narrowing | undefined,
): string | undefined {
  for (const key of [...Object.keys(query.relations ?? {}), ...Object.keys(query.computed ?? {})]) {
    const name = relationName(key);
    const relation = model.relations[name];
    if (!relation) {
      continue;
    }
    if (relation.variant !== undefined && relation.variant !== narrowing?.value) {
      return (
        `Relation "${name}" is declared on variant '${relation.variant}' of model ${model.name}, so it loads only from a collection narrowed with .variant('${relation.variant}'). ` +
        `Return orm.${model.name}.variant('${relation.variant}') (or a relation typed as that variant).`
      );
    }
    if (narrowing?.viaModel && relation.variant === undefined) {
      return (
        `Relation "${name}" is inherited from model ${model.name} and can't be included beneath a relation to a variant model: ` +
        'the ORM loads those rows through the variant model, which only has its own relations.'
      );
    }
    const child = query.relations?.[key];
    const problem = child && variantProblem(child, relation.target, child.args?.variant);
    if (problem) {
      return problem;
    }
  }
  return undefined;
}
