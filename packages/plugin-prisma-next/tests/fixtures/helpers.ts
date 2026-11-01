import { readFileSync } from 'node:fs';
import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import { contractFromJson as postgresContractFromJson } from '@prisma/orm-postgres/static';
import sqlite from '@prisma/orm-sqlite/runtime';
import {
  type ExecutionResult,
  execute,
  experimentalExecuteIncrementally,
  GraphQLDeferDirective,
  type GraphQLError,
  type GraphQLSchema,
  parse,
  specifiedDirectives,
} from 'graphql';
import { afterAll } from 'vitest';
import prismaNextPlugin, { type PrismaNextPluginOptions } from '../../src';
import type { Contract as CollisionContract } from './collision-contract';
import {
  type CapturedExecution,
  createSqliteRuntime,
  loadContract,
  type SampleContract,
  type SqliteRuntime,
  sampleContract,
  sampleDdl,
  withCapture,
} from './runtime';

export * from './runtime';

export const collisionContract = loadContract<CollisionContract>(
  new URL('./collision-contract.json', import.meta.url),
);

export const collisionDdl = `
  CREATE TABLE sheet (id INTEGER PRIMARY KEY, name TEXT NOT NULL, meta TEXT, role TEXT, count INTEGER);
  CREATE TABLE "row" (id INTEGER PRIMARY KEY, sheetId INTEGER NOT NULL, label TEXT NOT NULL);
  CREATE TABLE note (id INTEGER PRIMARY KEY, sheetId INTEGER NOT NULL, text TEXT, uniq TEXT UNIQUE);
  CREATE TABLE owner (id INTEGER PRIMARY KEY);
  CREATE TABLE profile (id INTEGER PRIMARY KEY, ownerId INTEGER NOT NULL UNIQUE);
  INSERT INTO sheet VALUES (1, 's1', '{"role:role":"admin","x:role":"admin"}', 'user', 99);
  INSERT INTO "row" VALUES (10, 1, 'r10'), (11, 1, 'r11');
  INSERT INTO note VALUES (20, 1, 'n20', 'u'), (21, 1, NULL, NULL);
  INSERT INTO owner VALUES (1), (2);
  INSERT INTO profile VALUES (5, 1);
`;

export const postgresUrl =
  process.env.POTHOS_PRISMA_NEXT_DATABASE_URL ??
  'postgresql://prisma:prisma@localhost:5456/prisma_next';

export function loadPostgresContract<C>(url: URL): C {
  return postgresContractFromJson(JSON.parse(readFileSync(url, 'utf8'))) as unknown as C;
}

/** A fresh seeded database for the enclosing test file. */
export function useDatabase<C extends Parameters<typeof createSqliteRuntime>[0]>(
  contract: C,
  ddl: string,
): SqliteRuntime<C> {
  const db = createSqliteRuntime(contract, ddl);
  afterAll(() => db.cleanup());
  return db;
}

let sampleDb: SqliteRuntime<SampleContract> | undefined;

/** The sample database `createBuilder` uses unless it is given a client. */
export function useSampleDb() {
  sampleDb = useDatabase(sampleContract, sampleDdl);
  return sampleDb;
}
export const useCollisionDb = () => useDatabase(collisionContract, collisionDdl);

export type SampleOptions<Context = object> = Omit<
  PrismaNextPluginOptions<SampleContract, Context>,
  'client' | 'contract'
> & {
  client?: PrismaNextPluginOptions<SampleContract, Context>['client'];
  /** Used with a client function. */
  contract?: SampleContract;
};

export function createBuilder<Context extends object = object>({
  client = sampleDb?.client ?? sqlite({ contract: sampleContract }),
  contract = sampleContract,
  ...options
}: SampleOptions<Context> = {}) {
  return new SchemaBuilder<{ PrismaNextContract: SampleContract; Context: Context }>({
    plugins: [ErrorsPlugin, RelayPlugin, prismaNextPlugin],
    relay: { nodesOnConnection: true },
    prismaNext:
      typeof client === 'function'
        ? { client, contract, ...options }
        : { client, ...options },
  });
}

export function deferSchema(builder: { toSchema(options?: object): GraphQLSchema }) {
  return builder.toSchema({ directives: [...specifiedDirectives, GraphQLDeferDirective] });
}

export interface RunResult {
  // biome-ignore lint/suspicious/noExplicitAny: assertions walk arbitrary response data
  data: any;
  errors?: readonly GraphQLError[];
  statements: CapturedExecution[];
}

export async function run(
  schema: GraphQLSchema,
  source: string,
  options: { variables?: Record<string, unknown>; context?: object } = {},
): Promise<RunResult> {
  const statements: CapturedExecution[] = [];
  const result: ExecutionResult = await withCapture(statements, async () =>
    execute({
      schema,
      document: parse(source),
      variableValues: options.variables,
      contextValue: options.context ?? {},
    }),
  );
  return { data: result.data, errors: result.errors, statements };
}

/** Runs a query with `@defer`, recording the statements issued before the initial payload. */
export function runIncremental(schema: GraphQLSchema, source: string) {
  const statements: CapturedExecution[] = [];
  return withCapture(statements, async () => {
    const result = await experimentalExecuteIncrementally({
      schema,
      document: parse(source),
      contextValue: {},
    });
    if (!('initialResult' in result)) {
      throw new Error('Expected an incremental result');
    }
    const initialStatements = statements.length;
    const patches: unknown[] = [];
    const patchErrors: unknown[] = [];
    const completedErrors: unknown[] = [];
    for await (const patch of result.subsequentResults) {
      for (const entry of patch.incremental ?? []) {
        patches.push('data' in entry ? entry.data : entry.items);
        patchErrors.push(...(entry.errors ?? []));
      }
      for (const entry of patch.completed ?? []) {
        if (entry.errors) {
          completedErrors.push(...entry.errors);
        }
      }
    }
    return {
      initial: result.initialResult,
      patches,
      patchErrors,
      completedErrors,
      initialStatements,
      statements,
    };
  });
}

/** The columns a statement reads from `table`, in any subquery. */
export function columnsOf(sql: string, table: string) {
  return new Set([...sql.matchAll(new RegExp(`"${table}"\\."(\\w+)"`, 'g'))].map((m) => m[1]));
}

/** How many times a statement reads the post table. */
export const postSubqueries = (sql: string) => (sql.match(/FROM "post"/g) ?? []).length;

export const globalId = (type: string, id: string) =>
  Buffer.from(`${type}:${id}`).toString('base64');
