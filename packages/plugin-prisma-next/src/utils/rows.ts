import { brandWithType, getTypeBrand } from '@pothos/core';
import type { SplitSelect } from './compile-select.js';
import { InternalError } from './errors.js';
import type { FieldLoads, LoadRef } from './loads.js';
import type { PrismaModel } from './model.js';

/*
 * ORM rows are never mutated. Readers see a parsed copy: the plain load under the relation's name
 * and the other `combine()` branches under `BRANCHES`, by id. A field whose select writes its own
 * loads under their names reads a view of that copy, which only its resolver sees.
 */

type Row = Record<string, unknown>;

interface Held {
  readonly row: object;
  readonly loads: Record<string, Record<string, unknown>>;
}

/** Enumerable, so other plugins' spread copies keep it. JSON or structuredClone copies reload. */
const BRANCHES = Symbol('prismaBranches');
const VIEW_OF = Symbol('prismaViewOf');

type Holder = { [BRANCHES]?: Held; [VIEW_OF]?: object };

export const PAGE = Symbol('prismaPage');

export interface PageData {
  readonly count: number | undefined;
}

const parsed = new WeakMap<object, object>();

/**
 * The ORM row itself when nothing beneath it was combined. Every relation of the hierarchy is
 * read, so a row first read as an interface keeps a variant's branches. A row holding no relation
 * isn't memoised, since reading it again costs no more than the lookup.
 */
export function parseRow(row: object, model: PrismaModel): object {
  const done = parsed.get(row);
  if (done) {
    return done;
  }
  let copy: Row | undefined;
  let loads: Held['loads'] | undefined;
  let holdsRelation = false;
  for (const name in model.relations) {
    const value = (row as Row)[name];
    if (value === null || typeof value !== 'object') {
      continue;
    }
    holdsRelation = true;
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
  if (!holdsRelation) {
    return row;
  }
  if (copy) {
    (copy as Holder)[BRANCHES] = { row, loads: loads ?? {} };
    parsed.set(copy, copy);
  }
  parsed.set(row, copy ?? row);
  return copy ?? row;
}

function parseValue(value: object, model: PrismaModel): unknown {
  if (!Array.isArray(value)) {
    return parseRow(value, model);
  }
  let copy: unknown[] | undefined;
  for (let i = 0; i < value.length; i += 1) {
    const item: unknown = value[i];
    const row = item !== null && typeof item === 'object' ? parseRow(item, model) : item;
    if (row !== item) {
      copy ??= [...value];
      copy[i] = row;
    }
  }
  return copy ?? value;
}

export function readLoad(row: object, { load, id }: LoadRef): unknown {
  return id === undefined
    ? (row as Row)[load.relation]
    : (row as Holder)[BRANCHES]?.loads[load.relation]?.[id];
}

export function sourceOf(row: object): object {
  return (row as Holder)[BRANCHES]?.row ?? row;
}

export function baseOf<T>(value: T): T {
  return ((value as Holder | null)?.[VIEW_OF] as T | undefined) ?? value;
}

export interface RowCheck {
  readonly columns: readonly string[];
  readonly relations: readonly (readonly [string, RowCheck | undefined])[];
}

export function rowCheck(selects: readonly SplitSelect[], toOneOf?: PrismaModel): RowCheck {
  const columns = new Set<string>();
  const nested = new Map<string, SplitSelect[]>();
  for (const { columns: own, relations } of selects) {
    for (const column of own) {
      columns.add(column);
    }
    for (const { name, select: split } of relations) {
      if (toOneOf?.relations[name]?.isToMany) {
        continue;
      }
      const beneath = nested.get(name) ?? [];
      nested.set(name, split ? [...beneath, split] : beneath);
    }
  }
  return {
    columns: [...columns],
    relations: [...nested].map(([name, splits]) => [
      name,
      splits.length ? rowCheck(splits) : undefined,
    ]),
  };
}

const holding = new WeakMap<RowCheck, WeakMap<object, boolean>>();

/** Memoised when it reads relations: parsed rows never change. */
export function holdsType(row: object, check: RowCheck): boolean {
  if (!check.relations.length) {
    return holds(row, check);
  }
  const rows = holding.get(check) ?? holding.set(check, new WeakMap()).get(check)!;
  let held = rows.get(row);
  if (held === undefined) {
    held = holds(row, check);
    rows.set(row, held);
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
    check.relations.every(
      ([name, nested]) => row[name] !== undefined && (!nested || holds(row[name], nested)),
    )
  );
}

const views = new WeakMap<object, Map<FieldLoads, object>>();
const checked = new WeakSet<FieldLoads>();

/**
 * Cached per row so per-row caches such as scope-auth's see one object. An aggregate's keys are
 * known only once it ran, so the first view checks none repeats or names a column or relation.
 */
export function viewOf(row: object, loads: FieldLoads): object {
  const byLoads = views.get(row) ?? views.set(row, new Map()).get(row)!;
  const cached = byLoads.get(loads);
  if (cached) {
    return cached;
  }
  const view = copyOf(row);
  (view as Holder)[VIEW_OF] = row;
  const written = checked.has(loads) ? undefined : new Set<string>();
  const { columns, relations } = loads.model;
  const write = (key: string, value: unknown, taken = false) => {
    if (written && (taken || written.has(key))) {
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
        write(key, computed, columns.has(key) || Object.hasOwn(relations, key));
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

/** Keeps keys of the reloaded parent that aren't the model's, such as another plugin's. */
export function withOtherKeys(loaded: Row, row: object, model: PrismaModel): Row {
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

function copyOf(row: object): Row {
  const copy = Object.assign(Object.create(Object.getPrototypeOf(row)) as Row, row);
  const brand = getTypeBrand(row);
  if (brand) {
    brandWithType(copy, brand);
  }
  return copy;
}
