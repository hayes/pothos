import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('imports the built package without optional Pothos plugins', () => {
  // Exercise the published CommonJS entrypoint in a separate process, even though the
  // workspace has every optional plugin installed. CI builds packages before their tests.
  const entry = fileURLToPath(new URL('../lib/index.js', import.meta.url));
  const output = execFileSync(
    process.execPath,
    [
      '-e',
      `
    const Module = require('node:module');
    const load = Module._load;
    Module._load = function(name, ...args) {
      if (name === '@pothos/plugin-relay' || name === '@pothos/plugin-with-input') {
        throw new Error('Optional plugin imported: ' + name);
      }
      return load.call(this, name, ...args);
    };
    const plugin = require(process.argv[1]);
    if (plugin.default !== 'prismaNext') throw new Error('Missing plugin export');
    process.stdout.write('ok');
  `,
      entry,
    ],
    { encoding: 'utf8' },
  );
  expect(output).toBe('ok');
});
