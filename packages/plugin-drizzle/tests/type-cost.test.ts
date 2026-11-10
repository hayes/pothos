// The types tsc creates for code whose cost can grow faster than the table count. The fixture is
// measured beyond the builder it uses, so the count doesn't depend on the machine.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const tsc = `${dirname(createRequire(import.meta.url).resolve('typescript/package.json'))}/bin/tsc`;
const cwd = fileURLToPath(new URL('type-cost/', import.meta.url));

function typeCount(project: string) {
  const output = execFileSync(
    process.execPath,
    [tsc, '--project', project, '--extendedDiagnostics', '--pretty', 'false'],
    { cwd, encoding: 'utf8' },
  );
  const count = /^Types:\s+(\d+)$/m.exec(output)?.[1];

  if (!count) {
    throw new Error(`tsc printed no type count:\n${output}`);
  }

  return Number(count);
}

describe('type cost', () => {
  it('checks a table-name union against each table once', { timeout: 120_000 }, () => {
    const builder = typeCount('tsconfig.builder.json');

    // About 42,000 types with the fixture's 100 tables, and 206,000 when the field methods pair
    // each key with every table's row.
    expect(typeCount('tsconfig.json') - builder).toBeLessThan(90_000);
  });
});
