import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@prisma/orm-sqlite/config';
import { createSqliteControlClient } from '@prisma/orm-sqlite/control';

const config = defineConfig({
  contract: fileURLToPath(new URL('./collision.prisma', import.meta.url)),
  output: fileURLToPath(new URL('./collision-contract.json', import.meta.url)),
});
const result = await createSqliteControlClient().emit({
  contractConfig: { source: config.contract!.source, output: config.contract!.output! },
});
await writeFile(new URL('./collision-contract.json', import.meta.url), result.assertOk().contractJson);
