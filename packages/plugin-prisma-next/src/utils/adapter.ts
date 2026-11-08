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
  /** The count reducer for a `combine()` slot. Targets without aggregates, such as MySQL, lack it. */
  count(): unknown;
}

/** A statement a plan built, and whether it applies a connection's cursor values. */
export interface PlannedQuery {
  query: MapperCollection;
  cursors: boolean;
}

export type PrismaNextNode = Node<PrismaNextModel>;
export type PrismaNextPlan = Plan<PrismaNextModel, PrismaNextSelection>;

/** Every selection key the plugin plans names a relation of its level's model. */
function relationOf(model: PrismaNextModel, name: string): PrismaNextRelation {
  return model.relations[name]!;
}

type Visitor = QueryVisitor<PrismaNextModel, PrismaNextSelection>;

/** The loads of one relation on a level: the plain one, and the others by id. */
interface RelationLoads {
  plain?: PrismaNextSelection;
  keyed: [string, PrismaNextSelection][];
  computed: [string, ComputedSelection][];
}

/**
 * Reads Prisma Next selections into the selection-mapper's node tree and turns planned nodes into
 * collection calls. `NodeAdapter` decides how nodes merge and conflict. Loads of a relation are
 * keyed by what they load, so equal loads merge and others never conflict.
 */
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

  /**
   * Records the selection of each object type that implements a prisma interface of the same
   * model. A row loaded as the interface may resolve as any of them, so the interface loads what
   * each of them selects.
   */
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
   * A type's own `select`, each of its interfaces' selects and, for an interface, its
   * implementations' selections: a row loaded as the interface is resolved as one of them, whose
   * `isTypeOf`, auth checks and fields read it even when the query has no fragment on that type.
   *
   * They all fit one node: the type-level selects of a model agree, and load under the relations'
   * names. A type's `select`
   * can't name a relation only a variant declares, but a base model's relation can't be included
   * beneath a relation that targets a variant model, nor a base column read beneath one that
   * targets a variant with a table of its own. `mergeQuery` leaves those out of such a level.
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

  fieldSelection(field: GraphQLField<unknown, unknown>, type: WalkedType) {
    // An interface field counts as planned even without a select of its own. The implementation
    // it resolves on then reads the branches the interface planned for it.
    const own = field.extensions?.[PRISMA_NEXT_FIELD_SELECTION] as
      | PrismaNextSelection
      | PrismaNextSelectFn
      | undefined;
    return own ?? (implementationsOf(type) ? EMPTY : undefined);
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
      visit.relation(key, relationOf(model, splitKey(key)[0]).target, selection.relations![key]);
    }
    for (const key of Object.keys(selection.computed ?? {})) {
      visit.computed(key, selection.computed![key], 'relation');
    }
    visit.args(selection.args ?? EMPTY);
  }

  /**
   * A field's relations the ORM can't include on a level are left for the loader, and so is a field
   * that would take a level past `MAX_RELATION_LOADS`. Each level a plan plays is checked, so no
   * statement grows past it, however the document nests aliases with different arguments.
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
   * Whether `node` can take the loads `selection` adds within `MAX_RELATION_LOADS`. A refused
   * field reloads its parent, so a level of a model without an identity, which can't be reloaded,
   * takes any selection. So does a level that loads nothing yet: a reload merges its field before
   * the type's selection, so the field fits there however much it loads.
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
   * A type's selection merges whatever level it lands on, so what that level can't load, a base
   * relation beneath a relation targeting a variant model or a base column beneath one targeting a
   * variant with a table of its own, is left out. So are the relations past `MAX_RELATION_LOADS`
   * when it merges behind a reload's field. The type's fields, and scope-auth's checks, reload
   * it.
   */
  override mergeQuery(
    node: PrismaNextNode,
    selection: PrismaNextSelection,
    options?: MergeOptions,
  ) {
    const fits = this.withoutUnloadable(selection, node);
    super.mergeQuery(node, options?.lenient ? this.withinCap(node, fits) : fits, options);
  }

  /** `selection` without the top-level loads that would take `node` past `MAX_RELATION_LOADS`. */
  private withinCap(node: PrismaNextNode, selection: PrismaNextSelection): PrismaNextSelection {
    const held = this.toQuery(node);
    let total = loads(held);
    const fits = (part: PrismaNextSelection) => {
      const added = loads(part, held);
      if (total + added > MAX_RELATION_LOADS) {
        return false;
      }
      total += added;
      return true;
    };
    const relations = Object.entries(selection.relations ?? {});
    const computed = Object.entries(selection.computed ?? {});
    const keptRelations = relations.filter(([key, child]) => fits({ relations: { [key]: child } }));
    const keptComputed = computed.filter(([key, value]) => fits({ computed: { [key]: value } }));
    return keptRelations.length === relations.length && keptComputed.length === computed.length
      ? selection
      : {
          ...selection,
          relations: Object.fromEntries(keptRelations),
          computed: Object.fromEntries(keptComputed),
        };
  }

  /** `selection`, itself when nothing changes, without what `node`'s level can't load. */
  private withoutUnloadable(selection: PrismaNextSelection, { model, args }: PrismaNextNode) {
    const narrowing = selection.args?.variant ?? (args as RelationArgs).variant;
    const fits = ([key]: [string, unknown]) =>
      canInclude(relationOf(model, splitKey(key)[0]), narrowing);
    const readable = readableColumns(model, narrowing);
    const columnFits = (column: string) => !readable || readable.has(column);
    const relations = Object.entries(selection.relations ?? {});
    const computed = Object.entries(selection.computed ?? {});
    return relations.every(fits) &&
      computed.every(fits) &&
      (selection.columns ?? []).every(columnFits)
      ? selection
      : {
          ...selection,
          // `null`, every column the level reads, stays as it is.
          columns: selection.columns ? selection.columns.filter(columnFits) : selection.columns,
          relations: Object.fromEntries(relations.filter(fits)),
          computed: Object.fromEntries(computed.filter(fits)),
        };
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

  /** Applies `selection` to `collection`: selects its columns and includes each relation once. */
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
    branches: BranchNames,
  ): MapperCollection {
    let result = selection.columns?.length ? collection.select(...selection.columns) : collection;
    // The ORM includes a relation once, so all of its loads share one include.
    const byRelation = new Map<string, RelationLoads>();
    const loadsOf = (name: string) => {
      let entry = byRelation.get(name);
      if (!entry) {
        entry = { keyed: [], computed: [] };
        byRelation.set(name, entry);
      }
      return entry;
    };
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
      const relation = relationOf(model, name);
      result = result.include(name, (rel) => this.emitRelation(rel, relation, entry, branches));
    }
    return result;
  }

  /**
   * Loads a relation's plain load as the include itself, or, beside other loads, as branches of
   * one `combine()`: `n/_` for the plain load, `n/id` for another load or a count, and `n/id:key`
   * for each value an aggregate computes. Each `n` is unique in the statement: the ORM aliases a
   * branch by its name cut to 63 bytes, and renames the ones that then collide one at a time, which
   * would cost time quadratic in their number where a shared walk repeats a load at each place.
   */
  private emitRelation(
    rel: MapperCollection,
    relation: PrismaNextRelation,
    { plain, keyed, computed }: RelationLoads,
    branches: BranchNames,
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
    // Every to-one load is plain.
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

/** Numbers the `combine()` branches of one statement. */
interface BranchNames {
  next: number;
}

/**
 * The most relations and computed values one level of a statement loads, counting those beneath
 * it. Each to-many load with its own arguments is a `combine()` slot of its own, so a document
 * that nests aliases with different arguments doubles them at every level. Each slot is a table
 * of its relation's join, which MySQL caps at 61 tables and SQLite at 64.
 */
const MAX_RELATION_LOADS = 61;

/** The relations and computed values `selection` loads, and those beneath, that `held` lacks. */
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

/**
 * Whether the ORM can include `relation` on a level narrowed to `narrowing`. A relation declared on
 * a variant needs a level narrowed to that variant. A relation of the base model can't be included
 * beneath a relation that targets a variant model, which only has that variant's relations.
 */
export function canInclude(
  { declaredByVariant }: PrismaNextRelation,
  narrowing: Narrowing | undefined,
) {
  return declaredByVariant === undefined
    ? !narrowing?.throughVariantModel
    : declaredByVariant === narrowing?.value;
}

/**
 * The columns a level narrowed to `narrowing` can read, when it can't read all of the model's. A
 * multi-table variant model's own accessor reads only its own table and the key it shares.
 */
function readableColumns(model: PrismaNextModel, narrowing: Narrowing | undefined) {
  return narrowing?.throughVariantModel
    ? model.variantTableColumns.get(narrowing.value)
    : undefined;
}

/** The registry of implementation selections a prisma interface carries. `onTypeConfig` adds it. */
function implementationsOf(type: GraphQLNamedType) {
  return type.extensions?.[PRISMA_NEXT_IMPLEMENTATIONS] as
    | Map<string, PrismaNextSelection>
    | undefined;
}
