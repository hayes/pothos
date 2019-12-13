#!/usr/bin/env node

import yargs from 'yargs';
import path from 'path';
import fs from 'fs';
import { buildSchema } from 'graphql';
import GiraphQLConverter from '.';

export default yargs.command(
  'convert <path>',
  'convert SDL to GiraphQL',
  args => {
    args.option('out', { type: 'string', description: 'path to write output to' });
    args.alias('o', 'out');
    args.option('types', { type: 'array', description: 'list of types to output' });
    args.alias('t', 'types');
    args.positional('path', { description: 'path to SDL file', type: 'string' });
  },
  argv => {
    const inputPath = path.resolve(process.cwd(), argv.path as string);

    if (!fs.existsSync(inputPath)) {
      throw new Error(`Schema not found ${inputPath}`);
    }

    const schemaText = fs.readFileSync(inputPath, 'utf8');

    const converter = new GiraphQLConverter(buildSchema(schemaText), {
      types: (argv.types as string[]) || null,
    });

    const output = converter.toString();

    if (argv.out) {
      fs.writeFileSync(path.resolve((process.cwd(), argv.out as string)), output);
    } else {
      process.stdout.write(output);
    }
  },
).argv;
