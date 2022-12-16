/* eslint-disable unicorn/no-unsafe-regex */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable unicorn/no-process-exit */
/* eslint-disable no-console */
/* eslint-disable no-process-exit */

import inquirer from 'inquirer';
import inquirerFileTreeSelection from 'inquirer-file-tree-selection-prompt';

inquirer.registerPrompt('file-tree-selection', inquirerFileTreeSelection);

export {};

enum SchemaSourceKind {
  SDL = 'SDL',
  Executable = 'Executable',
  Nexus = 'Nexus',
  Endpoint = 'Endpoint',
}

inquirer
  .prompt<{
    schemaSourceKind: SchemaSourceKind;
    sdlPath?: string;
    endpointURL?: string;
    executableSchemaPath?: string;
  }>([
    {
      type: 'list',
      name: 'schemaSourceKind',
      message: 'How do you want to load your schema?',
      choices: [
        { name: 'A GraphQL SDL file', value: SchemaSourceKind.SDL },
        { name: 'An executable GraphQL Schema', value: SchemaSourceKind.Executable },
        { name: 'A Nexus Schema', value: SchemaSourceKind.Nexus },
        { name: 'A GraphQL endpoint', value: SchemaSourceKind.Endpoint },
      ],
    },
    {
      type: 'file-tree-selection',
      name: 'sdlPath',
      message: 'Path to your GraphQL SDL file',
      enableGoUpperDirectory: true,
      validate: (path: string) => path.endsWith('.graphql') || path.endsWith('.gql'),
      when: (answers) => answers.schemaSourceKind === SchemaSourceKind.SDL,
    },
    {
      type: 'file-tree-selection',
      name: 'executableSchemaPath',
      message: 'Where is your executable GraphQL Schema exported?',
      enableGoUpperDirectory: true,
      validate: (path: string) =>
        path.endsWith('.js') ||
        path.endsWith('.ts') ||
        path.endsWith('.mjs') ||
        path.endsWith('.mts'),
      when: (answers) => answers.schemaSourceKind === SchemaSourceKind.Executable,
    },
    {
      type: 'input',
      name: 'endpointURL',
      message: 'The URL of your GraphQL endpoint',
      enableGoUpperDirectory: true,
      validate: (url: string) => {
        const urlRegex = /^(http|https):\/\/[\w.-]+(:\d+)?(\/.*)?$/;
        return urlRegex.test(url);
      },
      when: (answers) => answers.schemaSourceKind === SchemaSourceKind.Endpoint,
    },
    {
      type: 'list',
      name: 'executableSchemaExport',
      message: 'Is your Nexus Schema?',
      when: (answers) => answers.executableSchemaPath,
      choices: (answers) => {
        import(answers.executableSchemaPath);
      },
    },
  ])
  .then((answers) => {
    console.log(answers);
  })
  .catch((error: unknown) => {
    if ((error as { isTtyError?: boolean }).isTtyError) {
      console.error("Prompt couldn't be rendered in the current environment");
    } else {
      console.error((error as Error).stack);
    }

    process.exit(1);
  });
