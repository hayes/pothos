import { completeValue, PothosSchemaError, PothosValidationError } from '@pothos/core';
import {
  type MergeOptions,
  type Node,
  NodeAdapter,
  type Plan,
  type QueryVisitor,
  type WalkedType,
} from '@pothos/selection-mapper';
import {
  type GraphQLField,
  type GraphQLNamedType,
  type GraphQLSchema,
  isInterfaceType,
} from 'graphql';
import {
  PRISMA_NEXT_FIELD_SELECT,
  PRISMA_NEXT_IMPLEMENTATIONS,
  PRISMA_NEXT_MODEL,
  PRISMA_NEXT_SELECT,
} from '../constants.js';
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
  EMPTY,
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

function relationOf(model: PrismaNextModel, name: string): PrismaNextRelation {
  const relation = model.relations[name];
  if (!relation) {
    throw new PothosValidationError(`Relation "${name}" does not exist on model ${model.name}`);
  }
  return relation;
}

type Visitor = QueryVisitor<PrismaNextModel, PrismaNextQuery>;

/** The consumers of one relation on a level: their rows and computed values, by scope. */
interface RelationConsumers {
  rows: [string, PrismaNextQuery][];
  computed: [string, ComputedSelection][];
}

/**
 * How Prisma Next selections read onto the shared node tree, and how a node becomes collection
 * calls. Merge, compare and conflict rules are `NodeAdapter`'s; to-many consumers never conflict
 * because each scope has its own slot.
 */
export class PrismaNextAdapter extends NodeAdapter<PrismaNextModel, PrismaNextQuery> {
  override readonly skipDeferredFragments: boolean;
  private readonly typeSelections = new WeakMap<
    GraphQLNamedType,
    { query?: PrismaNextQuery; conflicting: Map<string, PrismaNextQuery> }
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
   * Records, in the registry each prisma interface of this build carries, the selections of the
   * object types of its model that implement it: a row loaded as the interface may resolve as any
   * of them. Then plans each interface, so an implementation it can't load fails the build.
   */
  registerImplementations(schema: GraphQLSchema) {
    const interfaces = Object.values(schema.getTypeMap()).filter(
      (type) => isInterfaceType(type) && this.modelFor(type),
    );
    for (const type of interfaces) {
      const model = this.modelFor(type);
      const selections = implementationsOf(type)!;
      for (const impl of schema.getPossibleTypes(type as never)) {
        if (this.modelFor(impl) === model) {
          selections.set(impl.name, this.typeSelectionOf(impl).query!);
        }
      }
    }
    for (const type of interfaces) {
      this.typeSelectionOf(type);
    }
  }

  typeSelection(type: GraphQLNamedType): PrismaNextQuery | undefined {
    return this.typeSelectionOf(type).query;
  }

  /** Interfaces whose `select` conflicts with the type's own, so their fields load separately. */
  conflictingInterfaces(type: GraphQLNamedType): string[] {
    return [...this.typeSelectionOf(type).conflicting.keys()];
  }

  /**
   * The type's own selection, then each interface's in turn. An interface's columns always merge;
   * a relation or computed entry conflicting with what is already there is set aside, and the
   * fields that interface declares carry it instead, so they load separately.
   *
   * An interface also loads its implementations' selections, since its rows reach their
   * `isTypeOf`, auth and fields without a fragment. To-many relations and computed values go in
   * each implementation's own slots; the ORM includes a to-one relation once, so implementations
   * must agree on any the interface doesn't select.
   */
  private typeSelectionOf(type: GraphQLNamedType) {
    let selection = this.typeSelections.get(type);
    if (!selection) {
      const conflicting = new Map<string, PrismaNextQuery>();
      selection = { conflicting };
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
          if (own && current === type) {
            this.mergeQuery(node, own);
          } else if (own) {
            const conflicts = this.mergeParts(node, own);
            if (conflicts) {
              conflicting.set(current.name, conflicts);
            }
          }
          for (const iface of 'getInterfaces' in current ? current.getInterfaces() : []) {
            visit(iface);
          }
        };
        visit(type);
        // The interface's own to-one relations win on its rows, as an object's win on its own.
        const own = new Set(node.relations.keys());
        for (const [impl, query] of implementationsOf(type) ?? []) {
          const conflicts = this.mergeParts(node, query);
          const [toOne] = Object.keys(conflicts?.relations ?? {}).filter(
            (key) => !key.includes(SLOT) && !own.has(key),
          );
          if (toOne !== undefined) {
            throw new PothosSchemaError(
              `The select of '${impl}' loads to-one relation "${toOne}" differently from the other selections of prismaInterface '${type.name}', whose rows load it once for all implementations. Make the selections of "${toOne}" match.`,
            );
          }
        }
        this.mergeQuery(node, { columns: getIdentityFields(this.contract, model.name) });
        selection.query = this.toQuery(node);
      }
      this.typeSelections.set(type, selection);
    }
    return selection;
  }

  /**
   * Merges `query`'s columns, and each of its relation and computed entries that fits beside what
   * `node` holds. Returns the entries that did not, if any.
   */
  private mergeParts(node: PrismaNextNode, query: PrismaNextQuery): PrismaNextQuery | undefined {
    this.mergeQuery(node, { columns: query.columns });
    let conflicts: PrismaNextQuery | undefined;
    for (const [key, child] of Object.entries(query.relations ?? {})) {
      const part = { relations: { [key]: child } };
      if (this.canMergeQuery(node, part)) {
        this.mergeQuery(node, part);
      } else {
        conflicts ??= {};
        conflicts.relations = { ...conflicts.relations, [key]: child };
      }
    }
    for (const [key, value] of Object.entries(query.computed ?? {})) {
      const part = { computed: { [key]: value } };
      if (this.canMergeQuery(node, part)) {
        this.mergeQuery(node, part);
      } else {
        conflicts ??= {};
        conflicts.computed = { ...conflicts.computed, [key]: value };
      }
    }
    return conflicts;
  }

  fieldSelection(field: GraphQLField<unknown, unknown>, type: WalkedType) {
    let selection = this.fieldSelections.get(field);
    if (selection === undefined) {
      const own = field.extensions?.[PRISMA_NEXT_FIELD_SELECT] as
        | PrismaNextQuery
        | PrismaNextSelectFn
        | undefined;
      // A field of an interface is recorded as planned, so the implementation it resolves on
      // finds the slots the interface planned for that implementation's selection.
      selection = this.withInterfaceSelection(
        field,
        type,
        own ?? (implementationsOf(type) ? EMPTY : undefined),
      );
      this.fieldSelections.set(field, selection ?? null);
    }
    return selection ?? undefined;
  }

  /** A field declared by an interface whose selection was set aside carries that selection. */
  private withInterfaceSelection(
    field: GraphQLField<unknown, unknown>,
    type: WalkedType,
    own: PrismaNextQuery | PrismaNextSelectFn | undefined,
  ) {
    const { conflicting } = this.typeSelectionOf(type);
    const iface =
      conflicting.size > 0
        ? type.getInterfaces().find((i) => conflicting.has(i.name) && i.getFields()[field.name])
        : undefined;
    if (!iface) {
      return own;
    }
    const model = this.modelFor(type)!;
    const ifaceSelection = conflicting.get(iface.name)!;
    const merged = (query: PrismaNextQuery | false | null | undefined) =>
      this.mergedQuery(model, [ifaceSelection, query || EMPTY]);
    return typeof own === 'function'
      ? (((...args) => completeValue(own(...args), merged)) as PrismaNextSelectFn)
      : merged(own);
  }

  visitQuery(query: PrismaNextQuery, model: PrismaNextModel, visit: Visitor) {
    if (query.columns === null) {
      visit.allColumns();
    } else {
      for (const column of query.columns ?? []) {
        if (!model.columns.has(column)) {
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
    options?: MergeOptions,
  ): boolean {
    return (
      super.canMergeQuery(node, query, options) &&
      !variantIncludeError(query, node.model, (node.args as RelationArgs).variant)
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
    const problem = variantIncludeError(query, model, query.args?.variant);
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
    const consumers = new Map<string, RelationConsumers>();
    const consumersOf = (key: string) => {
      const name = relationName(key);
      let entry = consumers.get(name);
      if (!entry) {
        entry = { rows: [], computed: [] };
        consumers.set(name, entry);
      }
      return { scope: key.slice(name.length + 1), entry };
    };
    for (const [key, child] of Object.entries(query.relations ?? {})) {
      const { scope, entry } = consumersOf(key);
      entry.rows.push([scope, child]);
    }
    for (const [key, value] of Object.entries(query.computed ?? {})) {
      const { scope, entry } = consumersOf(key);
      entry.computed.push([scope, value]);
    }
    for (const [name, entry] of consumers) {
      const relation = relationOf(model, name);
      result = result.include(name, (rel) => this.emitRelation(rel, relation, entry, ctx));
    }
    return result;
  }

  private emitRelation(
    rel: MapperCollection,
    relation: PrismaNextRelation,
    { rows, computed }: RelationConsumers,
    ctx: object,
  ) {
    const target = relation.targetVariantModel;
    // The ORM reads a single-table variant's rows through the base table without filtering them.
    const base = target?.sharesTable
      ? rel.where((row: Record<string, { eq(value: unknown): unknown }>) =>
          row[target.field].eq(target.value),
        )
      : rel;
    const load = (query: PrismaNextQuery) => {
      const narrowing = query.args?.variant;
      const narrowed =
        narrowing && !narrowing.throughVariantModel ? base.variant(narrowing.value) : base;
      const refined = query.args?.[REFINE]?.(narrowed) ?? narrowed;
      return this.emitLevel(refined, query, relation.target, ctx);
    };
    // `compileSelect` keeps computed values off to-one relations.
    if (!relation.isToMany) {
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
function variantIncludeError(
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
    const declaredBy = relation.declaredByVariant;
    if (declaredBy !== undefined && declaredBy !== narrowing?.value) {
      return (
        `Relation "${name}" is declared on variant '${declaredBy}' of model ${model.name}, so it loads only from a collection narrowed with .variant('${declaredBy}'). ` +
        `Return orm.${model.name}.variant('${declaredBy}') (or a relation typed as that variant).`
      );
    }
    if (narrowing?.throughVariantModel && declaredBy === undefined) {
      return (
        `Relation "${name}" is inherited from model ${model.name} and can't be included beneath a relation to a variant model: ` +
        'the ORM loads those rows through the variant model, which only has its own relations.'
      );
    }
    const child = query.relations?.[key];
    const problem = child && variantIncludeError(child, relation.target, child.args?.variant);
    if (problem) {
      return problem;
    }
  }
  return undefined;
}

/** The registry of implementation selections a prisma interface carries (see `onTypeConfig`). */
function implementationsOf(type: GraphQLNamedType) {
  return type.extensions?.[PRISMA_NEXT_IMPLEMENTATIONS] as Map<string, PrismaNextQuery> | undefined;
}
