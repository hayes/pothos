import { execute } from '@pothos/test-utils';
import { type ConstValueNode, parse, versionInfo } from 'graphql';
import { describe, expect, it } from 'vitest';
import SchemaBuilder from '../src';

describe('graphql 17 scalar coercion hooks', () => {
  it('wires coerceInputValue/coerceInputLiteral/valueToLiteral through to the scalar', async () => {
    const calls: string[] = [];

    const builder = new SchemaBuilder<{
      Scalars: { Weird: { Input: string; Output: string } };
    }>({});

    builder.scalarType('Weird', {
      serialize: (v) => v,
      coerceInputValue: (v) => {
        calls.push('coerceInputValue');
        return `civ:${String(v)}`;
      },
      coerceInputLiteral: (node: ConstValueNode) => {
        calls.push('coerceInputLiteral');
        return `cil:${'value' in node ? String(node.value) : node.kind}`;
      },
      valueToLiteral: (v) => ({ kind: 'StringValue', value: String(v) }) as ConstValueNode,
    });

    builder.queryType({
      fields: (t) => ({
        echo: t.field({
          type: 'Weird',
          args: { in: t.arg({ type: 'Weird' }) },
          resolve: (_p, args) => args.in ?? 'none',
        }),
      }),
    });

    const schema = builder.toSchema();

    const inline = await execute({ schema, document: parse('{ echo(in: "hi") }') });
    const variable = await execute({
      schema,
      document: parse('query ($v: Weird) { echo(in: $v) }'),
      variableValues: { v: 'yo' },
    });

    if (versionInfo.major >= 17) {
      expect(inline.data).toEqual({ echo: 'cil:hi' });
      expect(variable.data).toEqual({ echo: 'civ:yo' });
      expect(calls).toContain('coerceInputLiteral');
      expect(calls).toContain('coerceInputValue');
    } else {
      // graphql 16 ignores the modern hooks; this asserts the build doesn't throw.
      expect(schema.getType('Weird')).toBeDefined();
    }
  });

  it('wires coerceOutputValue through to the scalar (no serialize provided)', async () => {
    const builder = new SchemaBuilder<{
      Scalars: { Out: { Input: string; Output: string } };
    }>({});

    // No `serialize` — output coercion comes from the graphql 17 `coerceOutputValue` hook.
    builder.scalarType('Out', {
      coerceOutputValue: (v) => `cov:${String(v)}`,
      parseValue: (v) => String(v),
    });

    builder.queryType({
      fields: (t) => ({
        value: t.field({ type: 'Out', resolve: () => 'x' }),
      }),
    });

    const schema = builder.toSchema();
    const result = await execute({ schema, document: parse('{ value }') });

    if (versionInfo.major >= 17) {
      expect(result.data).toEqual({ value: 'cov:x' });
    } else {
      // graphql 16 falls back to an identity serializer when `serialize` is absent.
      expect(result.data).toEqual({ value: 'x' });
    }
  });
});
