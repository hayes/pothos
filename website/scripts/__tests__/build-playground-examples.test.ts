import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('bundles nested files and preserves variant inputs on inherited operations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pothos-example-bundle-'));
  const example = join(root, 'playground-examples/greeting');
  try {
    await mkdir(join(example, 'models'), { recursive: true });
    await mkdir(join(example, 'variant-french'), { recursive: true });
    await writeFile(
      join(example, 'metadata.json'),
      JSON.stringify({
        id: 'greeting',
        title: 'Greeting',
        variants: [
          { id: 'english', title: 'English', default: true },
          { id: 'french', title: 'French' },
        ],
      }),
    );
    await writeFile(join(example, 'schema.ts'), "export { schema } from './models/schema';");
    await writeFile(join(example, 'models/schema.ts'), 'export const schema = {};');
    await writeFile(join(example, 'query.graphql'), '{ hello }');
    await writeFile(join(example, 'context.json'), '{"locale":"en"}');
    await writeFile(join(example, 'query.variables.json'), '{"name":"James"}');
    await writeFile(join(example, 'variant-french/schema.ts'), 'export const schema = {};');
    await writeFile(join(example, 'variant-french/query.context.json'), '{"locale":"fr"}');
    execFileSync(
      process.execPath,
      [
        fileURLToPath(new URL('../../../node_modules/tsx/dist/cli.mjs', import.meta.url)),
        fileURLToPath(new URL('../build-playground-examples.ts', import.meta.url)),
      ],
      { cwd: root, stdio: 'pipe' },
    );
    const base = JSON.parse(
      await readFile(join(root, 'public/playground-examples/greeting.json'), 'utf8'),
    );
    const variant = JSON.parse(
      await readFile(join(root, 'public/playground-examples/greeting-variant-french.json'), 'utf8'),
    );
    expect(base.files.map((file: { filename: string }) => file.filename)).toEqual([
      'schema.ts',
      'models/schema.ts',
    ]);
    expect(JSON.parse(base.queries[0].context)).toEqual({ locale: 'en' });
    expect(JSON.parse(variant.queries[0].context)).toEqual({ locale: 'fr' });
    expect(JSON.parse(variant.queries[0].variables)).toEqual({ name: 'James' });
    expect(variant.queries[0].query).toBe('{ hello }');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
