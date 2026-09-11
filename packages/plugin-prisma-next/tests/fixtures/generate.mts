import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@prisma/orm-sqlite/config';
import { createSqliteControlClient } from '@prisma/orm-sqlite/control';

const config = defineConfig({
  contract: fileURLToPath(new URL('./sample.prisma', import.meta.url)),
  output: fileURLToPath(new URL('./sample-contract.json', import.meta.url)),
});
const result = await createSqliteControlClient().emit({
  contractConfig: { source: config.contract!.source, output: config.contract!.output! },
});
const emitted = result.assertOk();
await writeFile(new URL('./sample-contract.json', import.meta.url), emitted.contractJson);
// The programmatic emitter still uses internal monorepo specifiers.
const declarations = emitted.contractDts
  .replaceAll('@internal/adapter-sqlite', '@prisma/orm-sqlite/adapter')
  .replaceAll('@internal/sql-contract', '@prisma/orm-family-sql/contract')
  .replaceAll('@internal/contract', '@prisma/orm-framework/contract');
await writeFile(new URL('./sample-contract.d.ts', import.meta.url), declarations);
