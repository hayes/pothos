import type { Position } from '@pothos/selection-mapper';
import type { FieldNode, GraphQLResolveInfo } from 'graphql';
import { assertGraphQLJsInfo } from './errors.js';

/*
 * A consumer is one reader of a to-many relation's rows or computed values. A field's consumer id
 * is a short hex string (`consumerId`). Every type-level `select` uses `TYPE_CONSUMER`. In a
 * selection, a to-many relation and its computed values are keyed by consumer, so each consumer
 * gets its own `combine()` branch (see branch-keys.ts).
 */

/**
 * The consumer id of every type-level `select`. The selects of a model agree, so they share their
 * branches. It isn't hex, so it never collides with a field's id.
 */
export const TYPE_CONSUMER = 'type';

/** The consumer ids of one operation, by key. */
interface ConsumerIds {
  readonly ids: Map<string, string>;
  readonly taken: Set<string>;
}

/**
 * Per operation, not per request: an operation's response keys are its document's, so its table is
 * bounded by the document, while a context can be shared by any number of documents.
 */
const operationIds = new WeakMap<object, ConsumerIds>();
/** The operation of each field node a plan starts from, recorded by `registerPlanRoots`. */
const rootOperations = new WeakMap<FieldNode, object>();
const positionIds = new WeakMap<Position, { id: string; table: ConsumerIds }>();
/** A number per field definition: Pothos builds an inherited field from the interface's options. */
const definitionIds = new WeakMap<object, number>();
let nextDefinitionId = 0;

/**
 * Checks `info` is graphql-js's and records the operation of the fields a plan for it starts from,
 * which the consumers beneath them are numbered in. Every entry point calls it before it plans.
 * A field node in a fragment two operations of one document share is recorded for whichever
 * planned last. That is harmless: ids are fixed per position once numbered, and any table numbers
 * distinct consumers apart.
 */
export function registerPlanRoots(info: GraphQLResolveInfo) {
  assertGraphQLJsInfo(info);
  for (const node of info.fieldNodes) {
    rootOperations.set(node, info.operation);
  }
}

/**
 * The id of the consumer selected at `position`: its parent consumer's id, the field's definition
 * and its response key, hashed, so a document gives the same SQL text whatever was planned before
 * it. Ids are unique per operation: a rare collision takes a suffix. So:
 *
 * - The field nodes of one response key (fragments that each select it) share one consumer, as
 *   their resolver finds one mapping.
 * - An implementation that inherits a field unchanged shares the interface's consumer, and an
 *   override has its own.
 * - Reloads of one field at several paths number their consumers alike, so a batch merges them
 *   rather than loading one copy of everything beneath per path.
 *
 * Reads `walkParent`, never `parent`, so numbering a consumer never keeps a walk from being shared.
 * Beneath a shared walk, every place reads the first place's positions, and so do its resolvers.
 */
export function consumerId(position: Position): string {
  return consumerOf(position).id;
}

function consumerOf(position: Position): { id: string; table: ConsumerIds } {
  let consumer = positionIds.get(position);
  if (consumer) {
    return consumer;
  }
  const { field, node, walkParent } = position;
  const above = walkParent && consumerOf(walkParent);
  let table = above?.table;
  if (!table) {
    const operation = rootOperations.get(node)!;
    table = operationIds.get(operation);
    if (!table) {
      table = { ids: new Map(), taken: new Set() };
      operationIds.set(operation, table);
    }
  }
  const definition: object = field.extensions?.pothosOptions ?? field;
  let definitionId = definitionIds.get(definition);
  if (definitionId === undefined) {
    definitionId = nextDefinitionId;
    nextDefinitionId += 1;
    definitionIds.set(definition, definitionId);
  }
  const key = `${above?.id ?? ''}|${definitionId}.${node.alias?.value ?? node.name.value}`;
  let id = table.ids.get(key);
  if (id === undefined) {
    const hash = hashOf(key);
    id = hash;
    for (let n = 1; table.taken.has(id); n += 1) {
      id = `${hash}-${n}`;
    }
    table.ids.set(key, id);
    table.taken.add(id);
  }
  consumer = { id, table };
  positionIds.set(position, consumer);
  return consumer;
}

/** FNV-1a: 32 bits of `key`, in hex. */
function hashOf(key: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(i), 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/**
 * The consumer id of the entries of a nested `select` beneath consumer `id`'s relation entry. It
 * differs from every other consumer's id, so no other reader of those rows reads its branches.
 */
export function nestedId(id: string) {
  return `${id}.`;
}

/** Whether `id` is the id of a nested `select`'s entries. */
export function isNestedId(id: string) {
  return id.endsWith('.');
}
