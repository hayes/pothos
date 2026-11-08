import {
  deepEqual,
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
import { branchName, consumerOfKey, relationName } from './branch-keys.js';
import { compileTypeSelect, typeSelects } from './compile-select.js';
import { getModel, type PrismaNextModel, type PrismaNextRelation } from './model.js';
import {
  COMPUTE,
  type ComputedSelection,
  EMPTY,
  loadsWholeRelation,
  type Narrowing,
  type PrismaNextSelectFn,
  type PrismaNextSelection,
  REFINE,
  type RelationArgs,
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

/** The consumers of one relation on a level: their rows and computed values, by consumer id. */
interface RelationConsumers {
  rows: [string, PrismaNextSelection][];
  computed: [string, ComputedSelection][];
}

/**
 * Reads Prisma Next selections into the selection-mapper's node tree and turns planned nodes into
 * collection calls. `NodeAdapter` decides how nodes merge and conflict. Consumers of a to-many
 * relation never conflict, because each consumer has its own branch.
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
   * They all fit one node. The type-level selects of a model agree and share their branches, and
   * a to-one relation is keyed by its name, so every type's `select` shares it. A type's `select`
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
      visit.relation(key, relationOf(model, relationName(key)).target, selection.relations![key]);
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
      canInclude(relationOf(model, relationName(key)), narrowing);
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
    // The ORM includes a relation once, so all of its consumers share one include.
    const consumers = new Map<string, RelationConsumers>();
    const consumersOf = (name: string) => {
      let entry = consumers.get(name);
      if (!entry) {
        entry = { rows: [], computed: [] };
        consumers.set(name, entry);
      }
      return entry;
    };
    for (const [key, child] of Object.entries(selection.relations ?? {})) {
      consumersOf(relationName(key)).rows.push([consumerOfKey(key), child]);
    }
    for (const [key, value] of Object.entries(selection.computed ?? {})) {
      consumersOf(relationName(key)).computed.push([consumerOfKey(key), value]);
    }
    for (const [name, entry] of consumers) {
      const relation = relationOf(model, name);
      result = result.include(name, (rel) => this.emitRelation(rel, relation, entry, branches));
    }
    return result;
  }

  private emitRelation(
    rel: MapperCollection,
    relation: PrismaNextRelation,
    { rows, computed }: RelationConsumers,
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
    if (!relation.isToMany) {
      // A to-one relation is keyed by its name, so it has one consumer.
      return load(rows[0]![1]);
    }
    const groups = this.shareRows(relation.target, rows);
    if (groups.length === 1 && computed.length === 0) {
      // Rows that are all of the relation can be read as `row[relation]` by anyone. Any others go
      // in a branch of their consumers, so readers of other consumers can't mistake them for that.
      const [ids, shared] = groups[0]!;
      const included = load(shared);
      if (loadsWholeRelation(shared)) {
        return included;
      }
      return this.combine(base, [[ids, included]], branches);
    }
    const slots: Branch[] = groups.map(([ids, selection]) => [ids, load(selection)]);
    for (const [ids, value] of shareComputed(computed)) {
      for (const [key, loaded] of Object.entries(value[COMPUTE](base))) {
        slots.push([ids, loaded, key]);
      }
    }
    return this.combine(base, slots, branches);
  }

  /**
   * Loads `slots` through `combine()`, each named by a number unique in the statement and then its
   * key. The ORM aliases a branch by its name cut to 63 bytes, and renames the ones that then
   * collide one at a time. A walk shared by several places loads the same consumers at each, so
   * without the number their names would repeat, and naming them would cost time quadratic in
   * their number.
   */
  private combine(
    base: MapperCollection,
    slots: Branch[],
    branches: BranchNames,
  ): MapperCollection {
    const named: Record<string, unknown> = {};
    for (const [ids, loaded, key] of slots) {
      named[branchName(branches.next, ids, key)] = loaded;
      branches.next += 1;
    }
    return base.combine(named);
  }

  /**
   * Groups the consumers of a relation whose selections agree, each group merged into one
   * selection, so aliases with equal arguments load one branch whatever the others load.
   */
  private shareRows(model: PrismaNextModel, rows: [string, PrismaNextSelection][]) {
    if (rows.length === 1) {
      return [[[rows[0]![0]], rows[0]![1]] as [string[], PrismaNextSelection]];
    }
    const groups: { ids: string[]; node: PrismaNextNode }[] = [];
    for (const [id, selection] of rows) {
      const group = groups.find(({ node }) => this.canMergeQuery(node, selection));
      if (group) {
        this.mergeQuery(group.node, selection);
        group.ids.push(id);
      } else {
        const node = this.createNode(model);
        this.mergeQuery(node, selection);
        groups.push({ ids: [id], node });
      }
    }
    return groups.map(
      ({ ids, node }) => [ids, this.toQuery(node)] as [string[], PrismaNextSelection],
    );
  }
}

/** A `combine()` branch: the consumers sharing it, what it loads, and its computed value's key. */
type Branch = [ids: string[], loaded: unknown, key?: string];

/** Numbers the `combine()` branches of one statement. */
interface BranchNames {
  next: number;
}

/**
 * The most relations and computed values one level of a statement loads, counting those beneath
 * it. Each to-many consumer with its own arguments is a `combine()` slot of its own, so a document
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
 * Groups the consumers of a relation that compute the same value under the same key, so each value
 * is computed once, however many aliases or agreeing type-level selects select it.
 */
function shareComputed(computed: [string, ComputedSelection][]) {
  const groups: [string[], ComputedSelection][] = [];
  for (const [id, value] of computed) {
    const group = groups.find(
      ([, other]) => other.key === value.key && deepEqual(other.loadIdentity, value.loadIdentity),
    );
    if (group) {
      group[0].push(id);
    } else {
      groups.push([[id], value]);
    }
  }
  return groups;
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
