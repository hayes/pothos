import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { coreTypeDefinitions } from '../../lib/playground/pothos-types';

it('preserves GraphQL Kind narrowing and TokenKind literals in the editor bundle', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pothos-graphql-types-'));
  try {
    const graphql = coreTypeDefinitions.find((definition) => definition.moduleName === 'graphql');
    expect(graphql).toBeDefined();
    const declarations = join(directory, 'graphql.d.ts');
    const usage = join(directory, 'usage.ts');
    writeFileSync(declarations, graphql!.content);
    writeFileSync(
      usage,
      `import { Kind, TokenKind, type ValueNode } from 'graphql';
      function integer(node: ValueNode): number {
        if (node.kind !== Kind.INT) throw new Error('Expected integer');
        const text: string = node.value;
        // @ts-expect-error the narrowed literal value is a string, not any
        const invalid: boolean = node.value;
        return Number(text);
      }
      const kind: typeof Kind.INT = 'IntValue';
      const token: typeof TokenKind.INT = 'Int';
      // @ts-expect-error AST and lexer kinds are distinct literals
      const wrong: typeof Kind.INT = token;
      `,
    );
    const program = ts.createProgram([declarations, usage], {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
      target: ts.ScriptTarget.ES2022,
    });
    expect(
      ts
        .getPreEmitDiagnostics(program)
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')),
    ).toEqual([]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
