import {
  type MergeOptions,
  type Node,
  NodeAdapter,
  type Plan,
  type QueryVisitor,
} from '@pothos/selection-mapper';
import type { CollectionState } from '@prisma/orm-family-sql/orm-client';
import {
  type GraphQLField,
  type GraphQLNamedType,
  type GraphQLSchema,
  isInterfaceType,
} from 'graphql';
import {
  MAX_RELATION_LOADS,
  PRISMA_FIELD_SELECTION,
  PRISMA_IMPLEMENTATIONS,
  PRISMA_MODEL,
} from '../constants.js';
import type { AnyContract } from '../types/models.js';
import { compileTypeSelect, typeSelects } from './compile-select.js';
import { InternalError } from './errors.js';
import { getModel, type PrismaModel, type PrismaRelation } from './model.js';
import {
  COMPUTE,
  type Compute,
  type ComputedSelection,
  EMPTY,
  type Narrowing,
  type PrismaSelectFn,
  type PrismaSelection,
  REFINE,
  type RelationArgs,
  splitKey,
} from './selections.js';

/**
 * A loose shape of orm-client's `Collection`. The typed one collapses `.select(name)` to
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
  /** Targets without aggregates, such as MySQL, lack it. */
  count(): unknown;
}

/** Collection type state does not track pagination or distinct settings. Check before any SQL. */
export function assertConnectionCollection(collection: MapperCollection): void {
  // Keep this dependency on the ORM's internal state at the adapter boundary. Structural
  // collection implementations need not expose ORM state.
  const state = (collection as { readonly state?: CollectionState }).state;
  if (!state) {
    return;
  }
  const methods: string[] = [];
  if (state.orderBy?.length) {
    methods.push('orderBy()');
  }
  if (state.includes.length) {
    methods.push('include()');
  }
  if (state.limit !== undefined) {
    methods.push('limit()');
  }
  if (state.offset !== undefined) {
    methods.push('offset()');
  }
  if (state.cursor !== undefined) {
    methods.push('cursor()');
  }
  if (state.distinct !== undefined) {
    methods.push('distinct()');
  }
  if (state.distinctOn !== undefined) {
    methods.push('distinctOn()');
  }
  if (methods.length) {
    throw new InternalError(
      `A connection's starting collection uses ${methods.join(', ')}. Return it without these operations; use query.orderBy for ordering and first/last for page size. The connection loads requested relations.`,
    );
  }
}

export type PrismaNode = Node<PrismaModel>;
export type PrismaPlan = Plan<PrismaModel, PrismaSelection>;

type Visitor = QueryVisitor<PrismaModel, PrismaSelection>;

interface RelationLoads {
  plain?: PrismaSelection;
  keyed: [string, PrismaSelection][];
  computed: [string, ComputedSelection][];
}

/** Loads are keyed by what they load, so equal loads merge and others never conflict. */
export class PrismaAdapter extends NodeAdapter<PrismaModel, PrismaSelection> {
  override readonly skipDeferredFragments: boolean;
  private readonly typeSelections = new WeakMap<GraphQLNamedType, PrismaSelection>();

  constructor(
    readonly contract: AnyContract,
    skipDeferredFragments: boolean,
  ) {
    super();
    this.skipDeferredFragments = skipDeferredFragments;
  }

  modelFor(type: GraphQLNamedType): PrismaModel | undefined {
    const name = type.extensions?.[PRISMA_MODEL] as string | undefined;
    return name === undefined ? undefined : getModel(this.contract, name);
  }

  /** A row loaded as an interface may resolve as any implementation, so loads what each selects. */
  registerImplementations(schema: GraphQLSchema) {
    for (const type of Object.values(schema.getTypeMap())) {
      const model = isInterfaceType(type) ? this.modelFor(type) : undefined;
      if (model) {
        const selections = implementationsOf(type)!;
        for (const impl of schema.getPossibleTypes(type as never)) {
          if (this.modelFor(impl) === model) {
            selections.set(impl.name, this.typeSelection(impl)!);
          }
        }
      }
    }
  }

  /**
   * A type's own `select`, its interfaces' and, for an interface, its implementations' selections,
   * whose `isTypeOf`, auth checks and fields read the row even without a fragment on that type.
   * They fit one node because a model's type-level selects agree.
   */
  typeSelection(type: GraphQLNamedType): PrismaSelection | undefined {
    const cached = this.typeSelections.get(type);
    const model = cached ? undefined : this.modelFor(type);
    if (!model) {
      return cached;
    }
    const node = this.createNode(model);
    for (const select of typeSelects(type)) {
      super.mergeQuery(node, compileTypeSelect(this.contract, select, model));
    }
    for (const selection of implementationsOf(type)?.values() ?? []) {
      super.mergeQuery(node, selection);
    }
    super.mergeQuery(node, { columns: model.identity });
    const selection = this.toQuery(node);
    this.typeSelections.set(type, selection);
    return selection;
  }

  fieldSelection(field: GraphQLField<unknown, unknown>) {
    return field.extensions?.[PRISMA_FIELD_SELECTION] as
      | PrismaSelection
      | PrismaSelectFn
      | undefined;
  }

  visitQuery(selection: PrismaSelection, model: PrismaModel, visit: Visitor) {
    if (selection.columns === null) {
      visit.allColumns();
    } else {
      for (const column of selection.columns ?? []) {
        visit.column(column);
      }
    }
    for (const key of Object.keys(selection.relations ?? {})) {
      visit.relation(key, model.relations[splitKey(key)[0]]!.target, selection.relations![key]);
    }
    for (const key of Object.keys(selection.computed ?? {})) {
      visit.computed(key, selection.computed![key], 'relation');
    }
    visit.args(selection.args ?? EMPTY);
  }

  /**
   * A field the ORM can't include on a level, or that would take it past `MAX_RELATION_LOADS`, is
   * left for the loader.
   */
  override canMergeQuery(
    node: PrismaNode,
    selection: PrismaSelection,
    options?: MergeOptions,
  ): boolean {
    return (
      super.canMergeQuery(node, selection, options) &&
      this.withoutUnloadable(selection, node) === selection &&
      (loads(selection) === 0 || this.withinLoadLimit(node, loads(selection, node)))
    );
  }

  /** Reloads batch, so a batch takes another reload's root within `MAX_RELATION_LOADS` too. */
  override canMergeNode(into: PrismaNode, from: PrismaNode): boolean {
    return super.canMergeNode(into, from) && this.withinLoadLimit(into, nodeLoads(from, into));
  }

  /**
   * A model without an identity can't be reloaded, so it takes any selection. So does a level that
   * loads nothing yet: a reload merges its field first, so it fits however much it loads.
   */
  private withinLoadLimit(node: PrismaNode, added: number) {
    if (!node.model.identity.length) {
      return true;
    }
    const total = nodeLoads(node);
    return total === 0 || total + added <= MAX_RELATION_LOADS;
  }

  /**
   * A type's selection merges whatever level it lands on, so what that level can't load (base
   * relations or columns beneath a variant model) is left out, as are loads past
   * `MAX_RELATION_LOADS` behind a reload's field. The type's fields and auth checks reload it.
   */
  override mergeQuery(node: PrismaNode, selection: PrismaSelection, options?: MergeOptions) {
    const fits = this.withoutUnloadable(selection, node);
    super.mergeQuery(node, options?.lenient ? this.withinCap(node, fits) : fits, options);
  }

  private withinCap(node: PrismaNode, selection: PrismaSelection): PrismaSelection {
    let total = nodeLoads(node);
    return keepLoads(selection, selection.columns, (part) => {
      const added = loads(part, node);
      if (total + added > MAX_RELATION_LOADS) {
        return false;
      }
      total += added;
      return true;
    });
  }

  /** Returns `selection` itself when nothing changes. */
  private withoutUnloadable(selection: PrismaSelection, { model, args }: PrismaNode) {
    const narrowing = selection.args?.variant ?? (args as RelationArgs).variant;
    const readable = readableColumns(model, narrowing);
    const { columns } = selection;
    return keepLoads(
      selection,
      readable && columns?.some((column) => !readable.has(column))
        ? columns.filter((column) => readable.has(column))
        : columns,
      (_part, key) => canInclude(model.relations[splitKey(key)[0]]!, narrowing),
    );
  }

  toQuery(node: PrismaNode): PrismaSelection {
    const selection: PrismaSelection = {
      columns: node.columns && [...node.columns],
      args: node.args,
    };
    if (node.relations.size > 0) {
      selection.relations = {};
      for (const [key, child] of node.relations) {
        selection.relations[key] = this.toQuery(child);
      }
    }
    if (node.computed.size > 0) {
      selection.computed = Object.fromEntries(node.computed) as Record<string, ComputedSelection>;
    }
    return selection;
  }

  /** Counts reducers through the ORM's public include refinement before budgeting them. */
  aggregate(
    collection: MapperCollection,
    model: PrismaModel,
    name: string,
    compute: Compute,
  ): ComputedSelection {
    let size = 0;
    const variant = model.relations[name]!.declaredByVariant;
    const parent = variant === undefined ? collection : collection.variant(variant);
    parent.include(name, (rel) => {
      size = Object.keys(compute(relationBase(rel, model.relations[name]!)) as object).length;
      return rel;
    });
    // Reducers carry table aliases, so emission builds them in its own include's scope.
    return { kind: 'agg', size, [COMPUTE]: compute };
  }

  emit(
    collection: MapperCollection,
    selection: PrismaSelection,
    model: PrismaModel,
  ): MapperCollection {
    return this.emitLevel(collection, selection, model, { next: 0 });
  }

  private emitLevel(
    collection: MapperCollection,
    selection: PrismaSelection,
    model: PrismaModel,
    branches: { next: number },
  ): MapperCollection {
    let result = selection.columns?.length ? collection.select(...selection.columns) : collection;
    // The ORM includes a relation once, so all of its loads share one include.
    const byRelation = new Map<string, RelationLoads>();
    const loadsOf = (name: string) =>
      byRelation.get(name) ?? byRelation.set(name, { keyed: [], computed: [] }).get(name)!;
    for (const [key, child] of Object.entries(selection.relations ?? {})) {
      const [name, id] = splitKey(key);
      if (id === undefined) {
        loadsOf(name).plain = child;
      } else {
        loadsOf(name).keyed.push([id, child]);
      }
    }
    for (const [key, value] of Object.entries(selection.computed ?? {})) {
      const [name, id] = splitKey(key);
      loadsOf(name).computed.push([id!, value]);
    }
    for (const [name, entry] of byRelation) {
      const relation = model.relations[name]!;
      result = result.include(name, (rel) => this.emitRelation(rel, relation, entry, branches));
    }
    return result;
  }

  /**
   * A plain load alone is the include itself; otherwise loads are `combine()` branches `n/_`,
   * `n/id` and `n/id:key` (per aggregate value). `n` is unique per statement because the ORM cuts
   * aliases to 63 bytes and renames collisions one at a time, which is quadratic.
   */
  private emitRelation(
    rel: MapperCollection,
    relation: PrismaRelation,
    { plain, keyed, computed }: RelationLoads,
    branches: { next: number },
  ): MapperCollection {
    const base = relationBase(rel, relation);
    const load = (selection: PrismaSelection) => {
      const narrowing = selection.args?.variant;
      const narrowed =
        narrowing && !narrowing.throughVariantModel ? base.variant(narrowing.value) : base;
      const refine = selection.args?.[REFINE];
      const refined = refine ? refine(narrowed) : narrowed;
      return this.emitLevel(refined, selection, relation.target, branches);
    };
    if (plain && !keyed.length && !computed.length) {
      return load(plain);
    }
    const spec: Record<string, unknown> = {};
    const name = (id: string, key?: string) =>
      `${branches.next++}/${id}${key === undefined ? '' : `:${key}`}`;
    if (plain) {
      spec[name('_')] = load(plain);
    }
    for (const [id, selection] of keyed) {
      spec[name(id)] = load(selection);
    }
    for (const [id, value] of computed) {
      const loaded = value[COMPUTE](base);
      if (value.kind === 'count') {
        spec[name(id)] = loaded;
      } else {
        for (const [key, reduced] of Object.entries(loaded as object)) {
          spec[name(id, key)] = reduced;
        }
      }
    }
    return base.combine(spec);
  }
}

/**
 * The loads `node` adds beyond what `held` holds, counting those beneath. A level with an identity
 * takes loads past its first merge only within `MAX_RELATION_LOADS`, so this reads few entries.
 */
function nodeLoads(node: PrismaNode, held?: PrismaNode): number {
  let count = 0;
  for (const [key, value] of node.computed) {
    count += held?.computed.get(key) === undefined ? ((value as ComputedSelection).size ?? 1) : 0;
  }
  for (const [key, child] of node.relations) {
    const heldChild = held?.relations.get(key);
    count += (heldChild ? 0 : 1) + nodeLoads(child, heldChild);
  }
  return count;
}

/** The loads `selection` adds beyond what `held` holds, counting those beneath. */
function loads(selection: PrismaSelection, held?: PrismaNode): number {
  let count = 0;
  for (const key of Object.keys(selection.computed ?? {})) {
    count += held?.computed.get(key) === undefined ? (selection.computed![key]!.size ?? 1) : 0;
  }
  for (const [key, child] of Object.entries(selection.relations ?? {})) {
    const heldChild = held?.relations.get(key);
    count += (heldChild ? 0 : 1) + loads(child, heldChild);
  }
  return count;
}

/** Returns `selection` itself when nothing changes. */
function keepLoads(
  selection: PrismaSelection,
  columns: PrismaSelection['columns'],
  keep: (part: PrismaSelection, key: string) => boolean,
): PrismaSelection {
  const relations = Object.entries(selection.relations ?? {});
  const computed = Object.entries(selection.computed ?? {});
  const keptRelations = relations.filter(([key, child]) =>
    keep({ relations: { [key]: child } }, key),
  );
  const keptComputed = computed.filter(([key, value]) => keep({ computed: { [key]: value } }, key));
  return columns === selection.columns &&
    keptRelations.length === relations.length &&
    keptComputed.length === computed.length
    ? selection
    : {
        ...selection,
        columns,
        relations: Object.fromEntries(keptRelations),
        computed: Object.fromEntries(keptComputed),
      };
}

/**
 * A variant's relation needs a level narrowed to it, and a base relation can't be included beneath
 * a relation targeting a variant model, which only has that variant's relations.
 */
export function canInclude(
  { declaredByVariant }: PrismaRelation,
  narrowing: Narrowing | undefined,
) {
  return declaredByVariant === undefined
    ? !narrowing?.throughVariantModel
    : declaredByVariant === narrowing?.value;
}

/** A multi-table variant model's accessor reads only its own table and the key it shares. */
function readableColumns(model: PrismaModel, narrowing: Narrowing | undefined) {
  return narrowing?.throughVariantModel
    ? model.variantTableColumns.get(narrowing.value)
    : undefined;
}

function implementationsOf(type: GraphQLNamedType) {
  return type.extensions?.[PRISMA_IMPLEMENTATIONS] as Map<string, PrismaSelection> | undefined;
}

/** The ORM reads a single-table variant's rows through the base table without filtering them. */
function relationBase(rel: MapperCollection, relation: PrismaRelation): MapperCollection {
  const target = relation.targetVariantModel;
  return target?.sharesTable
    ? rel.where((row: Record<string, { eq(value: unknown): unknown }>) =>
        row[target.field].eq(target.value),
      )
    : rel;
}
