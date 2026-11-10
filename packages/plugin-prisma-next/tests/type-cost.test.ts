// The types tsc creates for code whose cost can grow faster than the contract's model count. Each
// file is measured beyond the builder it uses, so the count doesn't depend on the machine.
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
  it('checks a select against every model key in one check per model', { timeout: 120_000 }, () => {
    const builder = typeCount('tsconfig.builder.json');

    // About 22,000 types with the fixture's 40 models, and 200,000 when each model is paired with
    // each model's shape.
    expect(typeCount('tsconfig.json') - builder).toBeLessThan(45_000);
  });

  it('checks a connection collection against its own model', { timeout: 120_000 }, () => {
    const builder = typeCount('tsconfig.relay-builder.json');

    // About 5,000 types each for eight connections and eight `load` calls, and 23,000 to 29,000
    // when each collection is checked against every model's collections.
    expect(typeCount('tsconfig.connections.json') - builder).toBeLessThan(12_000);
    expect(typeCount('tsconfig.loads.json') - builder).toBeLessThan(12_000);
  });
});
