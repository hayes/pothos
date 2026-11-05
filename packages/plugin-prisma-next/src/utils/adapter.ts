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
  PRISMA_NEXT_TYPE_SELECT,
} from '../constants.js';
import type { AnyContract } from '../types/models.js';
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
  type IncludedRelation,
  type IncludeRecord,
  KEY_SEPARATOR,
  loadsWholeRelation,
  type Narrowing,
  type PrismaNextSelectFn,
  type PrismaNextSelection,
  type RawSelect,
  REFINE,
  type RelationArgs,
  relationName,
  SCOPE_SEPARATOR,
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
  readonly state?: { readonly variantValue?: unknown };
}

export type PrismaNextNode = Node<PrismaNextModel>;
export type PrismaNextPlan = Plan<PrismaNextModel, PrismaNextSelection>;

/** Every selection key the plugin plans names a relation of its level's model. */
function relationOf(model: PrismaNextModel, name: string): PrismaNextRelation {
  return model.relations[name]!;
}

type Visitor = QueryVisitor<PrismaNextModel, PrismaNextSelection>;

/** The consumers of one relation on a level: their rows and computed values, by scope. */
interface RelationConsumers {
  rows: [string, PrismaNextSelection][];
  computed: [string, ComputedSelection][];
}

/**
 * Reads Prisma Next selections into the selection-mapper's node tree and turns planned nodes into
 * collection calls. `NodeAdapter` decides how nodes merge and conflict. Consumers of a to-many
 * relation never conflict, because each scope has its own slot.
 */
export class PrismaNextAdapter extends NodeAdapter<PrismaNextModel, PrismaNextSelection> {
  override readonly skipDeferredFragments: boolean;
  private readonly typeSelections = new WeakMap<GraphQLNamedType, PrismaNextSelection>();
  /** What `droppedBeneathVariantModel` found, by type and then by relation. */
  private readonly beneathVariantModel = new WeakMap<
    GraphQLNamedType,
    Map<PrismaNextRelation, PrismaNextSelection | null>
  >();
  private readonly withoutIdentity = new WeakMap<PrismaNextModel, boolean>();
  private readonly records = new WeakMap<object, IncludeRecord>();

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
   * They all fit one node. To-many relations and computed values use each type's own slots, and a
   * to-one relation is always `true` in a type's `select`. A type's `select` can't name a relation
   * only a variant declares, but a base model's relation can't be included beneath a relation that
   * targets a variant model, nor a base column read beneath one that targets a variant with a table
   * of its own. `mergeQuery` leaves those out of such a level.
   */
  typeSelection(type: GraphQLNamedType): PrismaNextSelection | undefined {
    const cached = this.typeSelections.get(type);
    const model = cached ? undefined : this.modelFor(type);
    if (!model) {
      return cached;
    }
    const node = this.createNode(model);
    const visited = new Set<GraphQLNamedType>();
    const visit = (current: GraphQLNamedType) => {
      if (visited.has(current)) {
        return;
      }
      visited.add(current);
      const raw = current.extensions?.[PRISMA_NEXT_TYPE_SELECT] as RawSelect | undefined;
      if (raw) {
        super.mergeQuery(node, compileTypeSelect(raw, model, current.name));
      }
      for (const iface of 'getInterfaces' in current ? current.getInterfaces() : []) {
        visit(iface);
      }
    };
    visit(type);
    for (const selection of implementationsOf(type)?.values() ?? []) {
      super.mergeQuery(node, selection);
    }
    super.mergeQuery(node, { columns: getIdentityFields(this.contract, model.key) });
    const selection = this.toQuery(node);
    this.typeSelections.set(type, selection);
    return selection;
  }

  /**
   * The columns and to-one relations of `type`'s selection that `mergeQuery` leaves out of a level
   * loading through a variant model's own accessor: the base model's relations and, for a variant
   * with a table of its own, the base's columns. A relation field returning such rows loads them
   * before it returns the rows, so plugins listed before this one see what the type's `select`
   * promises. Undefined when the level loses none.
   */
  droppedBeneathVariantModel(
    type: GraphQLNamedType,
    relation: PrismaNextRelation,
  ): PrismaNextSelection | undefined {
    let byRelation = this.beneathVariantModel.get(type);
    if (!byRelation) {
      byRelation = new Map();
      this.beneathVariantModel.set(type, byRelation);
    }
    let dropped = byRelation.get(relation);
    if (dropped === undefined) {
      const { targetVariantModel, target } = relation;
      const narrowing: Narrowing = { value: targetVariantModel!.value, throughVariantModel: true };
      const selection = this.typeSelection(type);
      const readable = readableColumns(target, narrowing);
      const columns = (selection?.columns ?? []).filter((column) => !readable?.has(column));
      const relations = Object.entries(selection?.relations ?? {}).filter(
        ([key]) =>
          key === relationName(key) &&
          !relationOf(target, key).isToMany &&
          !canInclude(relationOf(target, key), narrowing),
      );
      dropped =
        (readable && columns.length) || relations.length
          ? {
              ...(readable && columns.length ? { columns } : {}),
              ...(relations.length ? { relations: Object.fromEntries(relations) } : {}),
            }
          : null;
      byRelation.set(relation, dropped);
    }
    return dropped ?? undefined;
  }

  fieldSelection(field: GraphQLField<unknown, unknown>, type: WalkedType) {
    // An interface field counts as planned even without a select of its own. The implementation
    // it resolves on then reads the slots the interface planned for it.
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

  /**
   * Whether `node` can take the loads `selection` adds within `MAX_RELATION_LOADS`. A refused
   * field reloads its parent, so a level of a model without an identity, which can't be reloaded,
   * takes any selection. So does a level that loads nothing yet: a reload merges its field before
   * the type's selection, so the field fits there however much it loads.
   */
  private withinLoadLimit(node: PrismaNextNode, selection: PrismaNextSelection) {
    let withoutIdentity = this.withoutIdentity.get(node.model);
    if (withoutIdentity === undefined) {
      withoutIdentity = !getIdentityFields(this.contract, node.model.key).length;
      this.withoutIdentity.set(node.model, withoutIdentity);
    }
    if (withoutIdentity) {
      return true;
    }
    const held = this.toQuery(node);
    const total = loads(held);
    return total === 0 || total + loads(selection, held) <= MAX_RELATION_LOADS;
  }

  /**
   * A type's selection merges whatever level it lands on, so what that level can't load, a base
   * relation beneath a relation targeting a variant model or a base column beneath one targeting a
   * variant with a table of its own, is left out. The relation field loads the columns and to-one
   * relations left out of the type's selection before returning the rows (see
   * `droppedBeneathVariantModel`), and the type's fields reload the rest.
   */
  override mergeQuery(
    node: PrismaNextNode,
    selection: PrismaNextSelection,
    options?: MergeOptions,
  ) {
    super.mergeQuery(node, this.withoutUnloadable(selection, node), options);
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

  /**
   * Applies `selection` to `collection`: selects its columns and includes each relation once. What
   * it included is recorded for `recordOf`, which `takeSlots` reads the loaded rows by.
   */
  emit(
    collection: MapperCollection,
    selection: PrismaNextSelection,
    model: PrismaNextModel,
    ctx: object,
  ): MapperCollection {
    const [result, record] = this.emitLevel(collection, selection, model, ctx, { next: 0 });
    this.records.set(result, record);
    return result;
  }

  /** What `emit` included in `collection`, for `takeSlots` to read its rows by. */
  recordOf(collection: object): IncludeRecord | undefined {
    return this.records.get(collection);
  }

  private emitLevel(
    collection: MapperCollection,
    selection: PrismaNextSelection,
    model: PrismaNextModel,
    ctx: object,
    branches: BranchNames,
  ): [MapperCollection, IncludeRecord] {
    let result = selection.columns?.length ? collection.select(...selection.columns) : collection;
    const record: Record<string, IncludedRelation> = {};
    // The ORM includes a relation once, so all of its consumers share one include.
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
    for (const [key, child] of Object.entries(selection.relations ?? {})) {
      const { scope, entry } = consumersOf(key);
      entry.rows.push([scope, child]);
    }
    for (const [key, value] of Object.entries(selection.computed ?? {})) {
      const { scope, entry } = consumersOf(key);
      entry.computed.push([scope, value]);
    }
    for (const [name, entry] of consumers) {
      const relation = relationOf(model, name);
      // The ORM builds the include while `include` runs, so the record is complete when it returns.
      result = result.include(name, (rel) => {
        const [included, recorded] = this.emitRelation(rel, relation, entry, ctx, branches);
        record[name] = recorded;
        return included;
      });
    }
    return [result, record];
  }

  private emitRelation(
    rel: MapperCollection,
    relation: PrismaNextRelation,
    { rows, computed }: RelationConsumers,
    ctx: object,
    branches: BranchNames,
  ): [MapperCollection, IncludedRelation] {
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
      const refined = selection.args?.[REFINE]?.(narrowed) ?? narrowed;
      return this.emitLevel(refined, selection, relation.target, ctx, branches);
    };
    if (!relation.isToMany) {
      // A to-one relation is keyed by its name, so it has one consumer.
      const [included, nested] = load(rows[0]![1]);
      return [included, { nested }];
    }
    const shared = computed.length === 0 ? this.shareRows(relation.target, rows) : undefined;
    if (shared) {
      // Rows that are all of the relation can be read as `row[relation]` by anyone. Any others go
      // in a slot of their consumers, so readers at other scopes can't mistake them for that.
      const [included, nested] = load(shared);
      if (loadsWholeRelation(shared)) {
        return [included, { nested }];
      }
      const key = rows.map(([scope]) => scope).join(SCOPE_SEPARATOR);
      return this.combine(base, { [key]: included }, { [key]: nested }, branches);
    }
    const slots: Record<string, unknown> = {};
    const nested: Record<string, IncludeRecord> = {};
    for (const [scope, selection] of rows) {
      [slots[scope], nested[scope]] = load(selection);
    }
    for (const [scopes, value] of shareComputed(computed)) {
      const values = value[COMPUTE](base, ctx);
      for (const key of Object.keys(values)) {
        slots[`${scopes.join(SCOPE_SEPARATOR)}${KEY_SEPARATOR}${key}`] = values[key];
      }
    }
    return this.combine(base, slots, nested, branches);
  }

  /**
   * Loads `slots` through `combine()`, each named by a number unique in the statement and then its
   * key. The ORM aliases a branch by its name cut to 63 bytes, and renames the ones that then
   * collide one at a time. Slot keys spell out the fields above them, so beneath a deep document
   * they would share their first 63 bytes, and naming them would cost time quadratic in their
   * number. The alias starts with the relation's name, so a relation name past about 45 bytes cuts
   * into the number and brings the renaming back, which is slower but still correct.
   */
  private combine(
    base: MapperCollection,
    slots: Record<string, unknown>,
    nested: Record<string, IncludeRecord>,
    branches: BranchNames,
  ): [MapperCollection, IncludedRelation] {
    const named: Record<string, unknown> = {};
    const names: Record<string, string> = {};
    for (const key of Object.keys(slots)) {
      const name = `${branches.next}/${key}`;
      branches.next += 1;
      named[name] = slots[key];
      names[name] = key;
    }
    return [base.combine(named), { slots: nested, names }];
  }

  /** Merges the consumers of a relation into one selection when their selections agree. */
  private shareRows(model: PrismaNextModel, rows: [string, PrismaNextSelection][]) {
    if (rows.length === 1) {
      return rows[0][1];
    }
    const node = this.createNode(model);
    this.mergeQuery(node, rows[0][1]);
    for (const [, selection] of rows.slice(1)) {
      if (!this.canMergeQuery(node, selection)) {
        return undefined;
      }
      this.mergeQuery(node, selection);
    }
    return this.toQuery(node);
  }
}

/** Numbers the `combine()` branches of one statement. */
interface BranchNames {
  next: number;
}

/**
 * The most relations and computed values one level of a statement loads, counting those beneath
 * it. Each to-many consumer with its own arguments is a `combine()` slot of its own, so a document
 * that nests aliases with different arguments doubles them at every level.
 */
const MAX_RELATION_LOADS = 200;

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
 * Groups the consumers of a relation that compute the same values, so each value is computed
 * once, however many aliases select it.
 */
function shareComputed(computed: [string, ComputedSelection][]) {
  const groups: [string[], ComputedSelection][] = [];
  for (const [scope, value] of computed) {
    const group = groups.find(([, other]) => deepEqual(other.loadIdentity, value.loadIdentity));
    if (group) {
      group[0].push(scope);
    } else {
      groups.push([[scope], value]);
    }
  }
  return groups;
}

/**
 * Whether the ORM can include `relation` on a level narrowed to `narrowing`. A relation declared on
 * a variant needs a level narrowed to that variant. A relation of the base model can't be included
 * beneath a relation that targets a variant model, which only has that variant's relations.
 */
function canInclude({ declaredByVariant }: PrismaNextRelation, narrowing: Narrowing | undefined) {
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
