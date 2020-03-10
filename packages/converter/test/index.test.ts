import exampleSchema from '@giraphql/core/test/examples/random-stuff';
import starwarsSchema from '@giraphql/core/test/examples/starwars/schema';
import { spawn } from 'child_process';
import { printSchema } from 'graphql';
import GirphQLConverter from '../src';

function execTS(script: string) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const child = spawn('ts-node', {
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    child.on('error', err => reject(err));
    child.stdout.on('data', chunk => chunks.push(chunk));
    child.stdout.on('end', () => resolve(Buffer.concat(chunks).toString()));

    child.stdin.write(script);
    child.stdin.end();
  });
}

async function printGeneratedSchema(converter: GirphQLConverter) {
  const script = `import { printSchema } from 'graphql'\n${converter.toString()}\n\nconsole.log(printSchema(schema))`;

  const result = await execTS(script);

  return result;
}

describe('Code generator', () => {
  test('example schema', async () => {
    const converter = new GirphQLConverter(exampleSchema);

    expect(converter.toString()).toMatchSnapshot();

    const result = await printGeneratedSchema(converter);

    expect(result).toMatchSnapshot();
    expect(result.trim()).toEqual(printSchema(exampleSchema).trim());
  }, 10000);

  test('starwars schema', async () => {
    const converter = new GirphQLConverter(starwarsSchema);

    expect(converter.toString()).toMatchSnapshot();

    const result = await printGeneratedSchema(converter);

    expect(result).toMatchSnapshot();
    expect(result.trim()).toEqual(printSchema(starwarsSchema).trim());
  }, 10000);
});
