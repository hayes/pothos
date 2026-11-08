import type { GraphQLResolveInfo } from 'graphql';
import { consumerOfKey, relationName } from './branch-keys.js';
import { isNestedId, TYPE_CONSUMER } from './consumers.js';
import type { PrismaNextSelection } from './selections.js';

/*
 * Consumer ids are numbered per operation, so one id names another consumer in another operation,
 * or loads other arguments in another execution of this one. A statement names a field consumer's
 * branches by its load id instead: its id and a hash of what it loads in them (`loadIds`), which
 * the execution the statement is built for records (`recordLoadIds`). A row another plan loaded
 * then holds a branch of a load id the execution recorded only when it loads the same, so it is
 * read only as this execution would load it, and otherwise reloaded. Equal documents with equal
 * arguments name their branches alike, so their statements are the same.
 *
 * The branches of type-level `select`s are the same in every plan, and a nested `select`'s are
 * read only through its field's, so their ids are used as they are.
 */

const LOAD_SEPARATOR = '#';

/** The executions a statement is built for, by their variable values, as `forOperation` keys. */
export type Executions = readonly GraphQLResolveInfo['variableValues'][];

/**
 * The load ids of the field consumers whose to-many loads `selection`, a level of a statement,
 * names: each id with a hash of its rows' and computed values' selections.
 */
export function loadIds({ relations = {}, computed = {} }: PrismaNextSelection) {
  const owned = new Map<string, Required<Pick<PrismaNextSelection, 'relations' | 'computed'>>>();
  const ownerOf = (key: string) => {
    const id = consumerOfKey(key);
    if (id === TYPE_CONSUMER || isNestedId(id)) {
      return undefined;
    }
    let own = owned.get(id);
    if (!own) {
      own = { relations: {}, computed: {} };
      owned.set(id, own);
    }
    return own;
  };
  for (const [key, child] of Object.entries(relations)) {
    // A to-one relation is keyed by its name, and loads unbranched.
    const own = relationName(key) === key ? undefined : ownerOf(key);
    if (own) {
      own.relations[key] = child;
    }
  }
  for (const [key, value] of Object.entries(computed)) {
    const own = ownerOf(key);
    if (own) {
      own.computed[key] = value;
    }
  }
  return new Map([...owned].map(([id, own]) => [id, `${id}${LOAD_SEPARATOR}${hashOf(own)}`]));
}

/** The load ids each execution's statements named, by consumer id. */
const recorded = new WeakMap<object, Map<string, Set<string>>>();

/** Records that statements of `executions` name consumer `id`'s branches `loadId`. */
export function recordLoadIds(executions: Executions, id: string, loadId: string) {
  for (const execution of executions) {
    let ids = recorded.get(execution);
    if (!ids) {
      ids = new Map();
      recorded.set(execution, ids);
    }
    let loads = ids.get(id);
    if (!loads) {
      loads = new Set();
      ids.set(id, loads);
    }
    loads.add(loadId);
  }
}

/**
 * The load id of consumer `id` among `held`, the ids of a row's branches, that `info`'s execution
 * named, or `id` when the row holds none.
 */
export function plannedLoadId(
  info: GraphQLResolveInfo,
  id: string,
  held: ReadonlySet<string>,
): string {
  for (const loadId of recorded.get(info.variableValues)?.get(id) ?? []) {
    if (held.has(loadId)) {
      return loadId;
    }
  }
  return id;
}

/** The consumer id a load id carries. */
export function consumerOfLoad(loadId: string) {
  const separator = loadId.indexOf(LOAD_SEPARATOR);
  return separator < 0 ? loadId : loadId.slice(0, separator);
}

/** The hash of each selection a statement's naming read, as `canonical` writes it. */
const hashes = new WeakMap<PrismaNextSelection, string>();

function hashOf(selection: PrismaNextSelection): string {
  let found = hashes.get(selection);
  if (found === undefined) {
    found = hash(canonical(selection));
    hashes.set(selection, found);
  }
  return found;
}

/**
 * `selection` as a string that is equal only for selections that load the same: its columns, args,
 * relations and computed values.
 */
function canonical({ columns, args, relations, computed }: PrismaNextSelection): string {
  const keyed = <T>(entries: Record<string, T> | undefined, write: (value: T) => string) =>
    Object.keys(entries ?? {})
      .sort()
      .map((key) => `${JSON.stringify(key)}${write(entries![key]!)}`)
      .join(',');
  return [
    columns === null ? '*' : JSON.stringify([...(columns ?? [])].sort()),
    canonicalValue({ ...args }),
    keyed(relations, hashOf),
    keyed(computed, ({ key, loadIdentity }) => canonicalValue([key, loadIdentity])),
  ].join('|');
}

/** What `contextIdentity` holds a context in. */
class ContextIdentity {
  constructor(readonly context: object) {}
}

const contextIdentities = new WeakMap<object, ContextIdentity>();

/**
 * `context` as the identity of what callbacks built for it load, which is equal only for the same
 * context. A callback a query callback or a select function returns may read the context, so its
 * function and arguments alone don't tell what it loads.
 */
export function contextIdentity(context: object): object {
  let identity = contextIdentities.get(context);
  if (!identity) {
    identity = new ContextIdentity(context);
    contextIdentities.set(context, identity);
  }
  return identity;
}

/** Numbers for functions and objects that compare equal only to themselves. */
const tokens = new WeakMap<object, number>();
let nextToken = 0;

function token(value: object) {
  let found = tokens.get(value);
  if (found === undefined) {
    found = nextToken;
    nextToken += 1;
    tokens.set(value, found);
  }
  return found;
}

/**
 * `value`, the data of a load's identity, as a string that is equal for values `deepEqual` finds
 * equal. A function is the same function in every execution, as a query callback is. An object of
 * another class is told apart by its class and its string form, or by itself when it has none.
 */
function canonicalValue(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    switch (typeof value) {
      case 'string':
        return JSON.stringify(value);
      case 'bigint':
        return `${value}n`;
      case 'function':
        return `@${token(value)}`;
      default:
        return String(value);
    }
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalValue).join(',')}]`;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null || prototype === Object.prototype) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalValue(record[key])}`)
      .join(',')}}`;
  }
  if (value instanceof Date) {
    return `D${value.getTime()}`;
  }
  const text = String(value);
  return `@${token(prototype)}${text.startsWith('[object ') ? `@${token(value)}` : JSON.stringify(text)}`;
}

/** A 64-bit hash of `text`, in base 36: cyrb53's mixing, keeping both halves. */
function hash(text: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36).padStart(7, '0');
}
