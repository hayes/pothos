import { spawn } from 'child_process';
import { lexicographicSortSchema, printSchema } from 'graphql';
import exampleSchema from '@giraphql/core/tests/examples/random-stuff';
import starwarsSchema from '@giraphql/core/tests/examples/starwars/schema';
import GirphQLConverter from '../src';

function execTS(script: string) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const child = spawn('ts-node', {
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    child.on('error', (err) => void reject(err));
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stdout.on('end', () => void resolve(Buffer.concat(chunks).toString()));

    child.stdin.write(script);
    child.stdin.end();
  });
}

async function printGeneratedSchema(converter: GirphQLConverter) {
  const script = `import { printSchema, lexicographicSortSchema } from 'graphql'\n${converter.toString()}\n\nconsole.log(printSchema(lexicographicSortSchema(schema)))`;

  const result = await execTS(script);

  return result;
}

describe('Code generator', () => {
  it('example schema', async () => {
    const converter = new GirphQLConverter(exampleSchema);

    expect(converter.toString()).toMatchSnapshot();

    const result = await printGeneratedSchema(converter);

    expect(result).toMatchSnapshot();
    expect(result.trim()).toEqual(printSchema(lexicographicSortSchema(exampleSchema)).trim());
  }, 10000);

  it('starwars schema', async () => {
    const converter = new GirphQLConverter(starwarsSchema);

    expect(converter.toString()).toMatchSnapshot();

    const result = await printGeneratedSchema(converter);

    expect(result).toMatchSnapshot();
    expect(result.trim()).toEqual(printSchema(lexicographicSortSchema(starwarsSchema)).trim());
  }, 10000);
});
