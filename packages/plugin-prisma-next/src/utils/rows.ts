import { brandWithType, getTypeBrand } from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { SplitSelect } from './compile-select.js';
import { InternalError } from './errors.js';
import { type FieldLoads, type LoadKind, type LoadRef, ownLoads } from './loads.js';
import type { PrismaNextModel } from './model.js';

/*
 * Rows stay as the ORM returned them. A relation loaded more than one way comes back as a
 * `combine()` object of branches named `n/id`, `n/id:key` for a value an aggregate computes, and
 * `n/_` for the plain load. Readers see a parsed copy: the plain load under the relation's name and
 * the branches under `BRANCHES`, by id. A field whose select writes its own loads under their names
 * reads a view of that copy, which only its resolver sees.
 */

type Row = Record<string, unknown>;

interface Held {
  /** The ORM row the copy was made from. */
  readonly row: object;
  readonly loads: Record<string, Record<string, unknown>>;
}

/**
 * Enumerable, so `{ ...parent }` and `Object.assign` copies other plugins make keep what the copy
 * holds. JSON and structuredClone copies drop it, and reload.
 */
const BRANCHES = Symbol('prismaNextBranches');
const VIEW_OF = Symbol('prismaNextViewOf');

type Holder = { [BRANCHES]?: Held; [VIEW_OF]?: object };

/** Where a page's rows hold the count loaded with them. */
export const PAGE = Symbol('prismaNextPage');

export interface PageData {
  readonly count: number | undefined;
}

const parsed = new WeakMap<object, object>();

/**
 * `row`, a row of `model`, as its readers see it: the ORM row itself when nothing beneath it was
 * combined, otherwise one copy with the branches moved under `BRANCHES`. Every relation of the
 * model's hierarchy is read, so a row first read as an interface keeps a variant's branches, and
 * the plain loads beneath are parsed too, for the type-level selects that read them.
 */
export function parseRow(row: object, model: PrismaNextModel): object {
  if (Object.hasOwn(row, BRANCHES)) {
    return row;
  }
  const done = parsed.get(row);
  if (done) {
    return done;
  }
  let copy: Row | undefined;
  let loads: Held['loads'] | undefined;
  for (const name in model.relations) {
    const value = (row as Row)[name];
    if (value === null || typeof value !== 'object') {
      continue;
    }
    const relation = model.relations[name]!;
    let plain: unknown = value;
    if (relation.isToMany && !Array.isArray(value)) {
      loads ??= {};
      const slots: Record<string, unknown> = {};
      loads[name] = slots;
      plain = undefined;
      for (const [branch, loaded] of Object.entries(value)) {
        // The number only keeps the ORM's aliases apart.
        const named = branch.slice(branch.indexOf('/') + 1);
        const separator = named.indexOf(':');
        if (named === '_') {
          plain = loaded;
        } else if (separator < 0) {
          slots[named] = loaded;
        } else {
          const id = named.slice(0, separator);
          slots[id] ??= {};
          (slots[id] as Row)[named.slice(separator + 1)] = loaded;
        }
      }
    }
    if (plain) {
      plain = parseValue(plain, relation.target);
    }
    if (plain !== value) {
      copy ??= copyOf(row);
      if (plain === undefined) {
        delete copy[name];
      } else {
        copy[name] = plain;
      }
    }
  }
  if (copy) {
    (copy as Holder)[BRANCHES] = { row, loads: loads ?? {} };
  }
  parsed.set(row, copy ?? row);
  return copy ?? row;
}

function parseValue(value: object, model: PrismaNextModel): unknown {
  if (!Array.isArray(value)) {
    return parseRow(value, model);
  }
  let copy: unknown[] | undefined;
  value.forEach((item: unknown, i) => {
    const row = item !== null && typeof item === 'object' ? parseRow(item, model) : item;
    if (row !== item) {
      copy ??= [...value];
      copy[i] = row;
    }
  });
  return copy ?? value;
}

/** What `ref` reads on `row`, a parsed row. */
export function readLoad(row: object, { load, id }: LoadRef): unknown {
  return id === undefined
    ? (row as Row)[load.relation]
    : (row as Holder)[BRANCHES]?.loads[load.relation]?.[id];
}

/** What the field `info` resolves loaded of `kind` on `parent` (see `setOwnLoads`). */
export function readOwn(info: GraphQLResolveInfo, parent: object, kind: LoadKind): unknown {
  const ref = ownLoads(info.path)?.refs.find((own) => own.load.kind === kind);
  return ref && readLoad(parent, ref);
}

/** The ORM row `row`, a parsed row, was copied from. */
export function sourceOf(row: object): object {
  return (row as Holder)[BRANCHES]?.row ?? row;
}

/** The parsed row `value`, a field's view, was made from, or `value`. */
export function baseOf<T>(value: T): T {
  return ((value as Holder | null)?.[VIEW_OF] as T | undefined) ?? value;
}

/** The columns and relations, and those beneath, that type-level selects read. */
export interface RowCheck {
  readonly columns: readonly string[];
  readonly relations: ReadonlyMap<string, RowCheck | undefined>;
}

/** What `selects`, split type-level selects, read. */
export function rowCheck(selects: readonly SplitSelect[]): RowCheck {
  const columns = new Set<string>();
  const nested = new Map<string, SplitSelect[]>();
  for (const { columns: own, relations } of selects) {
    for (const column of own) {
      columns.add(column);
    }
    for (const [name, , split] of relations) {
      const beneath = nested.get(name) ?? [];
      nested.set(name, split ? [...beneath, split] : beneath);
    }
  }
  return {
    columns: [...columns],
    relations: new Map(
      [...nested].map(([name, splits]) => [name, splits.length ? rowCheck(splits) : undefined]),
    ),
  };
}

const holding = new WeakMap<object, WeakMap<RowCheck, boolean>>();

/** Whether `row`, a parsed row, holds what `check` reads. Parsed rows never change. */
export function holdsType(row: object, check: RowCheck): boolean {
  let checks = holding.get(row);
  if (!checks) {
    checks = new WeakMap();
    holding.set(row, checks);
  }
  let held = checks.get(check);
  if (held === undefined) {
    held = holds(row, check);
    checks.set(check, held);
  }
  return held;
}

function holds(value: unknown, check: RowCheck): boolean {
  if (value === null) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((row) => holds(row, check));
  }
  const row = value as Row;
  return (
    check.columns.every((column) => row[column] !== undefined) &&
    [...check.relations].every(
      ([name, nested]) => row[name] !== undefined && (!nested || holds(row[name], nested)),
    )
  );
}

const views = new WeakMap<object, Map<FieldLoads, object>>();
/** The loads whose views were checked to write each key once (see `viewOf`). */
const checked = new WeakSet<FieldLoads>();

/**
 * A copy of `row`, a parsed row, with what `loads` loaded under their names, cached per row so
 * per-row caches such as scope-auth's see one object. An aggregate's keys are known only once it
 * ran, so the first view of a field's loads checks that no two of them write one key.
 */
export function viewOf(row: object, loads: FieldLoads): object {
  let byLoads = views.get(row);
  if (!byLoads) {
    byLoads = new Map();
    views.set(row, byLoads);
  }
  const cached = byLoads.get(loads);
  if (cached) {
    return cached;
  }
  const view = copyOf(row);
  (view as Holder)[VIEW_OF] = row;
  const written = checked.has(loads) ? undefined : new Set<string>();
  const write = (key: string, value: unknown) => {
    if (written?.has(key)) {
      throw new InternalError(`A field's select writes '${key}' on its parent twice.`);
    }
    written?.add(key);
    view[key] = value;
  };
  for (const ref of loads.refs) {
    const value = readLoad(row, ref);
    const { kind, relation, page } = ref.load;
    const rows = ref.beneath ? mapRows(value, ref.beneath) : value;
    if (kind === 'agg') {
      for (const [key, computed] of Object.entries(value ?? {})) {
        write(key, computed);
      }
    } else if (page) {
      write(
        relation,
        Object.assign([...((rows as unknown[] | undefined) ?? [])], {
          [PAGE]: { count: ref.count && (readLoad(row, ref.count) as number) } satisfies PageData,
        }),
      );
    } else {
      write(relation, rows);
    }
  }
  checked.add(loads);
  byLoads.set(loads, view);
  return view;
}

function mapRows(value: unknown, loads: FieldLoads): unknown {
  const view = (row: object) => viewOf(parseRow(row, loads.model), loads);
  if (value == null || typeof value !== 'object') {
    return value;
  }
  return Array.isArray(value) ? value.map(view) : view(value);
}

/**
 * `loaded`, a row a reload returned, with the keys of `row`, the parent it reloads, that aren't
 * columns or relations of `model`, such as keys another plugin's copy added. It is copied only
 * when there are such keys.
 */
export function withOtherKeys(loaded: Row, row: object, model: PrismaNextModel): Row {
  let next: Row | undefined;
  for (const key of Object.keys(row)) {
    if (
      !model.columns.has(key) &&
      !Object.hasOwn(model.relations, key) &&
      !model.sharedVariantRelations.has(key)
    ) {
      next ??= copyOf(loaded);
      next[key] = (row as Row)[key];
    }
  }
  return next ?? loaded;
}

/** Copies a row into a writable object with the same prototype and type brand. */
function copyOf(row: object): Row {
  const copy = Object.assign(Object.create(Object.getPrototypeOf(row)) as Row, row);
  const brand = getTypeBrand(row);
  if (brand) {
    brandWithType(copy, brand);
  }
  return copy;
}
