// Deliberately imports neither @pothos/plugin-relay nor @pothos/plugin-with-input: both patch the
// field builder prototypes when imported, and vitest isolates each test file's modules.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('optional plugins', () => {
  it('imports the built package without plugin-relay or plugin-with-input', () => {
    // CI builds packages before their tests; the CommonJS entry point runs in its own process.
    const entry = fileURLToPath(new URL('../lib/index.js', import.meta.url));
    const output = execFileSync(
      process.execPath,
      [
        '-e',
        `
        const Module = require('node:module');
        const load = Module._load;
        Module._load = function (name, ...args) {
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
});
