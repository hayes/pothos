import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaygroundCases } from './playground-cases.mjs';

// Each example is a separate application. Plugin declaration merging must stay
// within its own program, just as it does in a fresh playground project.
export async function typecheckPlaygroundCases(examples, root = process.cwd()) {
  const fixture = await mkdtemp(join(root, '.playground-typecheck-'));
  let sourceCount = 0;
  try {
    for (const [index, example] of examples.entries()) {
      const directory = join(fixture, String(index));
      await mkdir(directory);
      const files = [];
      for (const file of example.bundle.files) {
        const path = resolve(directory, file.filename);
        if (!path.startsWith(`${directory}${sep}`)) {
          throw new Error(`${example.id}: source path escapes its bundle: ${file.filename}`);
        }
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, file.content);
        if (file.filename.endsWith('.ts')) {
          files.push(path);
        }
      }
      if (!files.length) {
        throw new Error(`${example.id}: no TypeScript source files`);
      }
      const config = join(directory, 'tsconfig.json');
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
      try {
        execFileSync('pnpm', ['exec', 'tsc', '-p', config], { cwd: root, stdio: 'pipe' });
      } catch (error) {
        throw new Error(
          `${example.id}: TypeScript check failed\n${error.stdout ?? ''}${error.stderr ?? ''}`,
          {
            cause: error,
          },
        );
      }
      sourceCount += files.length;
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
  return sourceCount;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const examples = await loadPlaygroundCases();
  const sourceCount = await typecheckPlaygroundCases(examples);
  console.log(
    `PASS ${sourceCount} playground source files in ${examples.length} isolated programs`,
  );
}
