import type { Position } from '@pothos/selection-mapper';
import type { FieldNode, GraphQLResolveInfo } from 'graphql';
import { assertGraphQLJsInfo } from './errors.js';

/*
 * A consumer is one reader of a to-many relation's rows or computed values. A field's consumer id
 * is a number (`consumerId`). Every type-level `select` uses `TYPE_CONSUMER`. In a selection,
 * a to-many relation and its computed values are keyed by consumer, so each consumer gets its own
 * `combine()` branch (see branch-keys.ts).
 */

/**
 * The consumer id of every type-level `select`. The selects of a model agree, so they share their
 * branches. It isn't a number, so it never collides with a field's id.
 */
export const TYPE_CONSUMER = 'type';

/**
 * The interned consumer ids of each execution, keyed by its variable values, which graphql builds
 * once per execution. Ids are numbered by one counter, so no two executions share one: a row
 * another execution loaded, as a cache shared by several executions returns, holds none of this
 * execution's branches, and its fields reload it.
 */
const executionIds = new WeakMap<object, Map<string, string>>();
let nextId = 0;
/** The execution of each field node a plan starts from, recorded by `registerPlanRoots`. */
const rootExecutions = new WeakMap<FieldNode, object>();
const positionIds = new WeakMap<Position, { id: string; table: Map<string, string> }>();
/** A number per field definition: Pothos builds an inherited field from the interface's options. */
const definitionIds = new WeakMap<object, number>();
let nextDefinitionId = 0;

/**
 * Checks `info` is graphql-js's and records the execution of the fields a plan for it starts from,
 * which the consumers beneath them are numbered in. Every entry point calls it right before it
 * plans, and every select function numbers its position before it runs (see `recordingLoads` in
 * adapter.ts), so a plan numbers its root before another execution of the document records it.
 */
export function registerPlanRoots(info: GraphQLResolveInfo) {
  assertGraphQLJsInfo(info);
  for (const node of info.fieldNodes) {
    rootExecutions.set(node, info.variableValues);
  }
}

/**
 * The id of the consumer selected at `position`: its parent consumer's id, the field's definition
 * and its response key, interned to a number per execution. So:
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

function consumerOf(position: Position): { id: string; table: Map<string, string> } {
  let consumer = positionIds.get(position);
  if (consumer) {
    return consumer;
  }
  const { field, node, walkParent } = position;
  const above = walkParent && consumerOf(walkParent);
  let table = above?.table;
  if (!table) {
    const execution = rootExecutions.get(node)!;
    table = executionIds.get(execution);
    if (!table) {
      table = new Map();
      executionIds.set(execution, table);
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
  let id = table.get(key);
  if (id === undefined) {
    id = String(nextId);
    nextId += 1;
    table.set(key, id);
  }
  consumer = { id, table };
  positionIds.set(position, consumer);
  return consumer;
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
