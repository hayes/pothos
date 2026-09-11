import { execFileSync } from 'node:child_process';
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const files = [];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
      files.push(resolve(path));
  }
}
await collect('playground-examples');
if (!files.length) throw new Error('No playground source files found');
const config = resolve(`.playground-typecheck-${process.pid}.json`);
try {
  await writeFile(
    config,
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
      files,
    }),
  );
  execFileSync('pnpm', ['exec', 'tsc', '-p', config], { stdio: 'inherit' });
  console.log(`PASS ${files.length} playground source files type-checked`);
} finally {
  await unlink(config);
}
