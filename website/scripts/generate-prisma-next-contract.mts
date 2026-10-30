import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@prisma/orm-sqlite/config';
import { createSqliteControlClient } from '@prisma/orm-sqlite/control';

const example = new URL('../playground-examples/plugin-prisma-next/', import.meta.url);
const config = defineConfig({
  contract: fileURLToPath(new URL('schema.prisma', example)),
  output: fileURLToPath(new URL('contract.json', example)),
});
const emitted = (
  await createSqliteControlClient().emit({
    contractConfig: { source: config.contract!.source, output: config.contract!.output! },
  })
).assertOk();
await writeFile(new URL('contract.json', example), emitted.contractJson);
// The programmatic emitter still uses internal monorepo specifiers.
await writeFile(
  new URL('contract.d.ts', example),
  emitted.contractDts
    .replaceAll('@internal/adapter-sqlite', '@prisma/orm-sqlite/adapter')
    .replaceAll('@internal/sql-contract', '@prisma/orm-family-sql/contract')
    .replaceAll('@internal/contract', '@prisma/orm-framework/contract'),
);
