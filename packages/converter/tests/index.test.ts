import { spawn } from 'node:child_process';
import { lexicographicSortSchema, printSchema } from 'graphql';
import { transform } from '@swc/core';
import PothosConverter from '../src';
import exampleSchema from './examples/random-stuff';
import starwarsSchema from './examples/starwars/schema';

async function execTS(script: string) {
  const compiled = await transform(script, {
    jsc: { parser: { syntax: 'typescript' }, target: 'es2019' },
    module: { type: 'commonjs' },
  });

  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const child = spawn('node', {
      stdio: ['pipe', 'pipe', 'inherit'],
      // eslint-disable-next-line unicorn/prefer-module
      cwd: __dirname,
    });

    child.on('error', (err) => void reject(err));
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stdout.on('end', () => void resolve(Buffer.concat(chunks).toString()));

    child.stdin.write(compiled.code);
    child.stdin.end();
  });
}

async function printGeneratedSchema(converter: PothosConverter) {
  const script = `import { printSchema, lexicographicSortSchema } from 'graphql'\n${converter.toString()}\n\nconsole.log(printSchema(lexicographicSortSchema(schema)))`;

  const result = await execTS(script);

  return result;
}

describe('Code generator', () => {
  it('example schema', async () => {
    const converter = new PothosConverter(exampleSchema);

    expect(converter.toString()).toMatchSnapshot();

    const result = await printGeneratedSchema(converter);

    expect(result).toMatchSnapshot();
    expect(result.trim()).toEqual(printSchema(lexicographicSortSchema(exampleSchema)).trim());
  }, 20_000);

  it('starwars schema', async () => {
    const converter = new PothosConverter(starwarsSchema);

    expect(converter.toString()).toMatchSnapshot();

    const result = await printGeneratedSchema(converter);

    expect(result).toMatchSnapshot();
    expect(result.trim()).toEqual(printSchema(lexicographicSortSchema(starwarsSchema)).trim());
  }, 20_000);
});
