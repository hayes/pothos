import { spawn } from 'child_process';
import { lexicographicSortSchema, printSchema } from 'graphql';
import GiraphQLConverter from '../src';
import exampleSchema from './examples/random-stuff';
import starwarsSchema from './examples/starwars/schema';

function execTS(script: string) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const child = spawn('ts-node', {
      stdio: ['pipe', 'pipe', 'inherit'],
      cwd: __dirname,
    });

    child.on('error', (err) => void reject(err));
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stdout.on('end', () => void resolve(Buffer.concat(chunks).toString()));

    child.stdin.write(script);
    child.stdin.end();
  });
}

async function printGeneratedSchema(converter: GiraphQLConverter) {
  const script = `import { printSchema, lexicographicSortSchema } from 'graphql'\n${converter.toString()}\n\nconsole.log(printSchema(lexicographicSortSchema(schema)))`;

  const result = await execTS(script);

  return result;
}

describe('Code generator', () => {
  it('example schema', async () => {
    const converter = new GiraphQLConverter(exampleSchema);

    expect(converter.toString()).toMatchSnapshot();

    const result = await printGeneratedSchema(converter);

    expect(result).toMatchSnapshot();
    expect(result.trim()).toEqual(printSchema(lexicographicSortSchema(exampleSchema)).trim());
  }, 10_000);

  it('starwars schema', async () => {
    const converter = new GiraphQLConverter(starwarsSchema);

    expect(converter.toString()).toMatchSnapshot();

    const result = await printGeneratedSchema(converter);

    expect(result).toMatchSnapshot();
    expect(result.trim()).toEqual(printSchema(lexicographicSortSchema(starwarsSchema)).trim());
  }, 10_000);
});
