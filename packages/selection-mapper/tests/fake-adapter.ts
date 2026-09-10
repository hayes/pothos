import { isThenable, type MaybePromise } from '@pothos/core';
import { execute } from '@pothos/test-utils';
import {
  buildSchema,
  type FieldNode,
  type GraphQLField,
  type GraphQLNamedType,
  type GraphQLObjectType,
  type GraphQLResolveInfo,
  parse,
} from 'graphql';
import type { Adapter, EntryVisitor, Mappings, Node, SelectFn, WalkedType } from '../src';
import { NodeAdapter, Plan } from '../src';
import type { NodeBase } from '../src/adapter';
import type { Mapping } from '../src/loader-map';
import type { EntryOptions } from '../src/types';

/** The plan type the fake adapter builds. */
export type FakePlan = Plan<FakeModel, FakeMap>;

/**
 * What a plugin's own entry point does with a plan: plan the field, play it, and hand back the
 * caller's own selection when the paths matched nothing. The package exported this as
 * `queryFromInfo` until prisma took it over — drizzle and prisma-next each override the rule, so
 * it is prisma's — and the tests that drive a whole walk keep a copy of it here.
 */
export function queryFromInfo<Model, Query, NodeType extends NodeBase<Model> = Node<Model>>(
  adapter: Adapter<Model, Query, NodeType>,
  options: EntryOptions<Query>,
): Query {
  const plan = Plan.fromInfo(adapter, options) as
    | MaybePromise<Plan<Model, Query, NodeType>>
    | undefined;

  return (
    plan
      ? isThenable(plan)
        ? plan.then((settled) => settled.query())
        : plan.query()
      : (options.initial ?? {})
  ) as Query;
}

/** A model: one object per name, so identity is model identity. */
export interface FakeModel {
  name: string;
  relations: Record<string, FakeModel>;
}

/**
 * A prisma-like map: no `select` means every column, `extras` are computed values keyed by name,
 * anything else is an argument.
 */
export interface FakeMap {
  select?: Record<string, boolean | FakeMap>;
  extras?: Record<string, unknown>;
  [arg: string]: unknown;
}

const ALL: FakeMap = Object.freeze({});

export function createModels(...names: string[]) {
  const models: Record<string, FakeModel> = {};

  for (const name of names) {
    models[name] = { name, relations: {} };
  }

  return models;
}

export type FakeVisitor = EntryVisitor<FakeModel, FakeMap>;

/**
 * How the fake map reads onto the shared query tree, and how a node is written back. The models
 * are the whole of the schema side, so a test that only needs the tree rules builds one with no
 * models at all.
 */
export class FakeAdapter extends NodeAdapter<FakeModel, FakeMap> {
  constructor(private readonly models: Record<string, FakeModel> = {}) {
    super();
  }

  modelFor(type: GraphQLNamedType) {
    return this.models[type.extensions?.model as string];
  }

  typeSelection(type: GraphQLNamedType) {
    return type.extensions?.model
      ? ((type.extensions.select as FakeMap | undefined) ?? ALL)
      : undefined;
  }

  fieldSelection(field: GraphQLField<unknown, unknown>, _type: WalkedType) {
    return field.extensions?.select as FakeMap | SelectFn<FakeMap> | undefined;
  }

  read({ select, extras, ...args }: FakeMap, model: FakeModel, visit: FakeVisitor) {
    // No `select` means every column, which is final (S-9).
    if (!select) {
      visit.allColumns();
    }

    for (const key of Object.keys(select ?? {})) {
      const value = select![key];

      if (!value) {
        continue;
      }

      const target = model.relations[key];

      if (target) {
        visit.relation(key, target, value === true ? ALL : value);
      } else {
        visit.column(key);
      }
    }

    for (const key of Object.keys(extras ?? {})) {
      visit.extra(key, extras![key]);
    }

    visit.args(args);
  }

  emit(node: Node<FakeModel>): FakeMap {
    const select: Record<string, boolean | FakeMap> = {};
    const query: FakeMap = { ...node.args };

    for (const [name, child] of node.relations) {
      const nested = this.emit(child);

      select[name] = hasKeys(nested) ? nested : true;
    }

    if (node.extras.size > 0) {
      query.extras = Object.fromEntries(node.extras);
    }

    if (node.columns) {
      for (const column of node.columns) {
        select[column] = true;
      }

      return { ...query, select };
    }

    return hasKeys(select) ? { ...query, select } : query;
  }
}

/**
 * A recorded mapping without the position the walker records with it, so a test can compare what
 * was mapped beneath a field on its own. Positions are asserted where they are the subject (D-7).
 */
export function mappingOf(mapping: Mapping | null | undefined) {
  return mapping ? { nested: mappingsOf(mapping.nested) } : mapping;
}

export function mappingsOf(mappings: Mappings) {
  const stripped: Record<string, unknown> = {};

  for (const key of Object.keys(mappings)) {
    stripped[key] = mappingOf(mappings[key]);
  }

  return stripped;
}

export interface TypeSetup {
  model?: string;
  select?: FakeMap;
  fields?: Record<string, FakeMap | SelectFn<FakeMap> | false>;
  extensions?: Record<string, unknown>;
}

/** Builds a schema from SDL and attaches the adapter's extensions to its types and fields. */
export function createSchema(sdl: string, setup: Record<string, TypeSetup>) {
  const schema = buildSchema(sdl);

  for (const [typeName, { model, select, fields, extensions }] of Object.entries(setup)) {
    const type = schema.getType(typeName) as GraphQLNamedType & {
      extensions: Record<string, unknown>;
      getFields?: () => Record<string, GraphQLField<unknown, unknown>>;
    };

    type.extensions = { ...type.extensions, ...extensions, model, select };

    for (const [fieldName, selection] of Object.entries(fields ?? {})) {
      const field = type.getFields!()[fieldName] as GraphQLField<unknown, unknown> & {
        extensions: Record<string, unknown>;
      };

      field.extensions = { ...field.extensions, select: selection };
    }
  }

  return schema;
}

/**
 * Executes `source` and captures the resolve info of the first root field, or of `at`
 * (`[typeName, fieldName]`) beneath it: the same shape a plugin's field resolver receives. Every
 * object resolves to an empty object so the nested resolver runs.
 */
export async function resolveInfo(
  schema: ReturnType<typeof buildSchema>,
  source: string,
  { at, variableValues }: { at?: [string, string]; variableValues?: Record<string, unknown> } = {},
) {
  let captured: GraphQLResolveInfo | undefined;
  const rootValue: Record<string, unknown> = {};

  for (const field of Object.keys(schema.getQueryType()!.getFields())) {
    rootValue[field] = (_args: unknown, _ctx: unknown, info: GraphQLResolveInfo) => {
      if (!at) {
        captured ??= info;
      }

      return {};
    };
  }

  if (at) {
    const field = (schema.getType(at[0]) as GraphQLObjectType).getFields()[at[1]];

    field.resolve = (_parent, _args, _ctx, info) => {
      captured ??= info;

      return null;
    };
  }

  const result = await execute({ schema, document: parse(source), rootValue, variableValues });

  if (!captured) {
    throw new Error(`No field resolved: ${JSON.stringify(result.errors)}`);
  }

  return captured;
}

export function fieldNodeOf(info: GraphQLResolveInfo): FieldNode {
  return info.fieldNodes[0];
}

/** Whether an object has any own enumerable key: `emit` writes `true` for an empty selection. */
function hasKeys(value: object) {
  return Object.keys(value).length > 0;
}
