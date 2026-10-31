// Emits each fixture's contract.json and contract.d.ts from its Prisma schema.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig as mysqlConfig } from '@prisma/orm-mysql/config';
import { createMysqlControlClient } from '@prisma/orm-mysql/control';
import { defineConfig as postgresConfig } from '@prisma/orm-postgres/config';
import { createPostgresControlClient } from '@prisma/orm-postgres/control';
import { defineConfig as sqliteConfig } from '@prisma/orm-sqlite/config';
import { createSqliteControlClient } from '@prisma/orm-sqlite/control';

const targets = {
  mysql: { defineConfig: mysqlConfig, client: createMysqlControlClient },
  postgres: { defineConfig: postgresConfig, client: createPostgresControlClient },
  sqlite: { defineConfig: sqliteConfig, client: createSqliteControlClient },
};

const fixtures: [schema: string, output: string, target: keyof typeof targets][] = [
  ['fixtures/sample.prisma', 'fixtures/sample-contract', 'sqlite'],
  ['fixtures/collision.prisma', 'fixtures/collision-contract', 'sqlite'],
  ['inheritance/contract.prisma', 'inheritance/contract', 'sqlite'],
  ['inheritance-namespaces/contract.prisma', 'inheritance-namespaces/contract', 'postgres'],
  ['namespaces/contract.prisma', 'namespaces/contract', 'postgres'],
  ['postgres/contract.prisma', 'postgres/contract', 'postgres'],
  ['mysql/contract.prisma', 'mysql/contract', 'mysql'],
];

for (const [schema, output, target] of fixtures) {
  const json = new URL(`${output}.json`, import.meta.url);
  const { contract } = targets[target].defineConfig({
    contract: fileURLToPath(new URL(schema, import.meta.url)),
    output: fileURLToPath(json),
  });
  const result = await targets[target].client().emit({
    contractConfig: { source: contract!.source, output: contract!.output! },
  });
  const emitted = result.assertOk();
  await writeFile(json, emitted.contractJson);
  // The programmatic emitter still uses internal monorepo specifiers. Map them to the published
  // facade exports.
  const declarations = emitted.contractDts
    .replaceAll(`@internal/target-${target}`, `@prisma/orm-${target}/target`)
    .replaceAll(`@internal/adapter-${target}`, `@prisma/orm-${target}/adapter`)
    .replaceAll('@internal/sql-contract', '@prisma/orm-family-sql/contract')
    .replaceAll('@internal/contract', '@prisma/orm-framework/contract');
  await writeFile(new URL(`${output}.d.ts`, import.meta.url), declarations);
}
