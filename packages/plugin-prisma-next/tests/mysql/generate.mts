import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@prisma/orm-mysql/config';
import { createMysqlControlClient } from '@prisma/orm-mysql/control';

const config = defineConfig({
  contract: fileURLToPath(new URL('./contract.prisma', import.meta.url)),
  output: fileURLToPath(new URL('./contract.json', import.meta.url)),
});
const result = await createMysqlControlClient().emit({
  contractConfig: { ...config.contract!, output: config.contract!.output! },
});
const emitted = result.assertOk();
await writeFile(new URL('./contract.json', import.meta.url), emitted.contractJson);
// The programmatic emitter still uses internal monorepo specifiers. Map them
// to the corresponding published facade exports in the checked-in fixture.
const declarations = emitted.contractDts
  .replaceAll('@internal/target-mysql', '@prisma/orm-mysql/target')
  .replaceAll('@internal/adapter-mysql', '@prisma/orm-mysql/adapter')
  .replaceAll('@internal/sql-contract', '@prisma/orm-family-sql/contract')
  .replaceAll('@internal/contract', '@prisma/orm-framework/contract');
await writeFile(new URL('./contract.d.ts', import.meta.url), declarations);
