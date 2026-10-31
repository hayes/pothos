import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@prisma/orm-postgres/config';
import { createPostgresControlClient } from '@prisma/orm-postgres/control';

const config = defineConfig({
  contract: fileURLToPath(new URL('./contract.prisma', import.meta.url)),
  output: fileURLToPath(new URL('./contract.json', import.meta.url)),
});
const result = await createPostgresControlClient().emit({
  contractConfig: { ...config.contract!, output: config.contract!.output! },
});
const emitted = result.assertOk();
await writeFile(new URL('./contract.json', import.meta.url), emitted.contractJson);
// The programmatic emitter still uses internal monorepo specifiers. Map them
// to the corresponding published facade exports in the checked-in fixture.
const declarations = emitted.contractDts
  .replaceAll('@internal/target-postgres', '@prisma/orm-postgres/target')
  .replaceAll('@internal/adapter-postgres', '@prisma/orm-postgres/adapter')
  .replaceAll('@internal/sql-contract', '@prisma/orm-family-sql/contract')
  .replaceAll('@internal/contract', '@prisma/orm-framework/contract');
await writeFile(new URL('./contract.d.ts', import.meta.url), declarations);
