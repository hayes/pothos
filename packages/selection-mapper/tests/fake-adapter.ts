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
import type { Adapter, SelectFn } from '../src';
import { deepEqual, relation } from '../src';

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

/** The extra threaded through walks: the names of the fields a select function hangs beneath. */
export type FakePath = string[];

const ALL: FakeMap = Object.freeze({});

export function createModels(...names: string[]) {
  const models: Record<string, FakeModel> = {};

  for (const name of names) {
    models[name] = { name, relations: {} };
  }

  return models;
}

export function createFakeAdapter(
  models: Record<string, FakeModel>,
  { withExtra = false } = {},
): Adapter<FakeModel, FakeMap, FakePath> {
  const adapter: Adapter<FakeModel, FakeMap, FakePath> = {
    skipDeferredFragments: true,
    empty: { select: {} },
    modelFor: (type) => models[type.extensions?.model as string],
    typeSelection: (type) =>
      type.extensions?.model ? ((type.extensions.select as FakeMap | undefined) ?? ALL) : undefined,
    fieldSelection: (field) =>
      field.extensions?.select as FakeMap | SelectFn<FakeMap, FakePath> | undefined,
    merge(node, { select, extras, ...args }) {
      if (!select) {
        node.columns = null;
      }

      for (const key of Object.keys(select ?? {})) {
        const value = select![key];

        if (!value) {
          continue;
        }

        const child = node.model.relations[key];

        if (child) {
          adapter.merge(relation(node, key, child, value), value === true ? ALL : value);
        } else {
          node.columns?.add(key);
        }
      }

      for (const key of Object.keys(extras ?? {})) {
        node.extras.set(key, extras![key]);
      }

      if (Object.keys(args).length > 0) {
        node.args = args;
      }
    },
    compatible(node, { select, extras, ...args }, ignoreArgs) {
      for (const key of Object.keys(select ?? {})) {
        const value = select![key];
        const child = node.relations.get(key);

        if (value && child && !adapter.compatible(child, value === true ? ALL : value, false)) {
          return false;
        }
      }

      for (const key of Object.keys(extras ?? {})) {
        if (node.extras.has(key) && !deepEqual(node.extras.get(key), extras![key])) {
          return false;
        }
      }

      return ignoreArgs || deepEqual(node.args, args);
    },
    typeLevelConflict(node, { select, extras }) {
      const relation = Object.keys(select ?? {}).find(
        (key) => !adapter.compatible(node, { select: { [key]: select![key] } }, true),
      );

      if (relation) {
        return { kind: 'relation', name: relation };
      }

      const extra = Object.keys(extras ?? {}).find(
        (key) => !adapter.compatible(node, { extras: { [key]: extras![key] } }, true),
      );

      return extra ? { kind: 'extra', name: extra } : undefined;
    },
    withoutConflicts(node, { select, extras, ...args }) {
      const kept: FakeMap = { ...args };

      if (select) {
        kept.select = {};

        for (const key of Object.keys(select)) {
          if (adapter.compatible(node, { select: { [key]: select[key] } }, true)) {
            kept.select[key] = select[key];
          }
        }
      }

      if (extras) {
        kept.extras = {};

        for (const key of Object.keys(extras)) {
          if (adapter.compatible(node, { extras: { [key]: extras[key] } }, true)) {
            kept.extras[key] = extras[key];
          }
        }
      }

      return kept;
    },
    serialize(node) {
      const select: Record<string, boolean | FakeMap> = {};
      const query: FakeMap = { ...node.args };

      for (const [name, child] of node.relations) {
        const nested = adapter.serialize(child);

        select[name] = Object.keys(nested).length > 0 ? nested : true;
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

      return Object.keys(select).length > 0 ? { ...query, select } : query;
    },
  };

  if (withExtra) {
    adapter.callbackExtra = (parent, type, _field, node) => [
      ...(parent ?? []),
      `${type.name}.${node.name.value}`,
    ];
  }

  return adapter;
}

export interface TypeSetup {
  model?: string;
  select?: FakeMap;
  fields?: Record<string, FakeMap | SelectFn<FakeMap, FakePath> | false>;
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
