import {
  type MergeOptions,
  type Node,
  NodeAdapter,
  type Plan,
  type QueryVisitor,
} from '@pothos/selection-mapper';
import {
  type GraphQLField,
  type GraphQLNamedType,
  type GraphQLSchema,
  isInterfaceType,
} from 'graphql';
import {
  PRISMA_NEXT_FIELD_SELECTION,
  PRISMA_NEXT_IMPLEMENTATIONS,
  PRISMA_NEXT_MODEL,
} from '../constants.js';
import type { AnyContract } from '../types/models.js';
import { compileTypeSelect, typeSelects } from './compile-select.js';
import { getModel, type PrismaNextModel, type PrismaNextRelation } from './model.js';
import {
  COMPUTE,
  type ComputedSelection,
  EMPTY,
  type Narrowing,
  type PrismaNextSelectFn,
  type PrismaNextSelection,
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

export interface PlannedQuery {
  query: MapperCollection;
  cursors: boolean;
}

export type PrismaNextNode = Node<PrismaNextModel>;
export type PrismaNextPlan = Plan<PrismaNextModel, PrismaNextSelection>;

type Visitor = QueryVisitor<PrismaNextModel, PrismaNextSelection>;

interface RelationLoads {
  plain?: PrismaNextSelection;
  keyed: [string, PrismaNextSelection][];
  computed: [string, ComputedSelection][];
}

/** Loads are keyed by what they load, so equal loads merge and others never conflict. */
export class PrismaNextAdapter extends NodeAdapter<PrismaNextModel, PrismaNextSelection> {
  override readonly skipDeferredFragments: boolean;
  private readonly typeSelections = new WeakMap<GraphQLNamedType, PrismaNextSelection>();

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
  typeSelection(type: GraphQLNamedType): PrismaNextSelection | undefined {
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
    return field.extensions?.[PRISMA_NEXT_FIELD_SELECTION] as
      | PrismaNextSelection
      | PrismaNextSelectFn
      | undefined;
  }

  visitQuery(selection: PrismaNextSelection, model: PrismaNextModel, visit: Visitor) {
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
    node: PrismaNextNode,
    selection: PrismaNextSelection,
    options?: MergeOptions,
  ): boolean {
    return (
      super.canMergeQuery(node, selection, options) &&
      this.withoutUnloadable(selection, node) === selection &&
      (loads(selection) === 0 || this.withinLoadLimit(node, selection))
    );
  }

  /** Reloads batch, so a batch takes another reload's root within `MAX_RELATION_LOADS` too. */
  override canMergeNode(into: PrismaNextNode, from: PrismaNextNode): boolean {
    return super.canMergeNode(into, from) && this.withinLoadLimit(into, this.toQuery(from));
  }

  /**
   * A model without an identity can't be reloaded, so it takes any selection. So does a level that
   * loads nothing yet: a reload merges its field first, so it fits however much it loads.
   */
  private withinLoadLimit(node: PrismaNextNode, selection: PrismaNextSelection) {
    if (!node.model.identity.length) {
      return true;
    }
    const held = this.toQuery(node);
    const total = loads(held);
    return total === 0 || total + loads(selection, held) <= MAX_RELATION_LOADS;
  }

  /**
   * A type's selection merges whatever level it lands on, so what that level can't load (base
   * relations or columns beneath a variant model) is left out, as are loads past
   * `MAX_RELATION_LOADS` behind a reload's field. The type's fields and auth checks reload it.
   */
  override mergeQuery(
    node: PrismaNextNode,
    selection: PrismaNextSelection,
    options?: MergeOptions,
  ) {
    const fits = this.withoutUnloadable(selection, node);
    super.mergeQuery(node, options?.lenient ? this.withinCap(node, fits) : fits, options);
  }

  private withinCap(node: PrismaNextNode, selection: PrismaNextSelection): PrismaNextSelection {
    const held = this.toQuery(node);
    let total = loads(held);
    return keepLoads(selection, selection.columns, (part) => {
      const added = loads(part, held);
      if (total + added > MAX_RELATION_LOADS) {
        return false;
      }
      total += added;
      return true;
    });
  }

  /** Returns `selection` itself when nothing changes. */
  private withoutUnloadable(selection: PrismaNextSelection, { model, args }: PrismaNextNode) {
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

  toQuery(node: PrismaNextNode): PrismaNextSelection {
    const selection: PrismaNextSelection = {
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

  emit(
    collection: MapperCollection,
    selection: PrismaNextSelection,
    model: PrismaNextModel,
  ): MapperCollection {
    return this.emitLevel(collection, selection, model, { next: 0 });
  }

  private emitLevel(
    collection: MapperCollection,
    selection: PrismaNextSelection,
    model: PrismaNextModel,
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
    relation: PrismaNextRelation,
    { plain, keyed, computed }: RelationLoads,
    branches: { next: number },
  ): MapperCollection {
    const target = relation.targetVariantModel;
    // The ORM reads a single-table variant's rows through the base table without filtering them.
    const base = target?.sharesTable
      ? rel.where((row: Record<string, { eq(value: unknown): unknown }>) =>
          row[target.field].eq(target.value),
        )
      : rel;
    const load = (selection: PrismaNextSelection) => {
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
 * The most loads one level of a statement holds, counting those beneath it. Each is a joined
 * table, which MySQL caps at 61 and SQLite at 64, and nested aliases with different arguments
 * double them at every level.
 */
const MAX_RELATION_LOADS = 61;

/** The loads `selection` adds beyond `held`, counting those beneath. */
function loads(selection: PrismaNextSelection, held?: PrismaNextSelection): number {
  let count = 0;
  for (const key of Object.keys(selection.computed ?? {})) {
    count += held?.computed?.[key] === undefined ? 1 : 0;
  }
  for (const [key, child] of Object.entries(selection.relations ?? {})) {
    const heldChild = held?.relations?.[key];
    count += (heldChild ? 0 : 1) + loads(child, heldChild);
  }
  return count;
}

/** Returns `selection` itself when nothing changes. */
function keepLoads(
  selection: PrismaNextSelection,
  columns: PrismaNextSelection['columns'],
  keep: (part: PrismaNextSelection, key: string) => boolean,
): PrismaNextSelection {
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
  { declaredByVariant }: PrismaNextRelation,
  narrowing: Narrowing | undefined,
) {
  return declaredByVariant === undefined
    ? !narrowing?.throughVariantModel
    : declaredByVariant === narrowing?.value;
}

/** A multi-table variant model's accessor reads only its own table and the key it shares. */
function readableColumns(model: PrismaNextModel, narrowing: Narrowing | undefined) {
  return narrowing?.throughVariantModel
    ? model.variantTableColumns.get(narrowing.value)
    : undefined;
}

function implementationsOf(type: GraphQLNamedType) {
  return type.extensions?.[PRISMA_NEXT_IMPLEMENTATIONS] as
    | Map<string, PrismaNextSelection>
    | undefined;
}
