/**
 * The `totalCount` gate of `t.relatedConnection` and `buildTotalCountPromise` reads the
 * connection's selection through `selectedFieldNames` from `@pothos/selection-mapper`. These pin
 * the directive and fragment rules the plugin relies on, through a real parsed document.
 */
import { selectedFieldNames } from '@pothos/selection-mapper';
import { execute } from '@pothos/test-utils';
import { buildSchema, type GraphQLResolveInfo, parse } from 'graphql';
import { describe, expect, it } from 'vitest';

const schema = buildSchema(/* GraphQL */ `
  directive @defer(if: Boolean = true, label: String) on FRAGMENT_SPREAD | INLINE_FRAGMENT
  type Query { connection: PostConnection }
  type PostConnection { totalCount: Int, edges: [PostEdge], nodes: [Post] }
  type PostEdge { cursor: String, node: Post }
  type Post { id: ID }
`);

async function infoFor(source: string, variableValues: Record<string, unknown> = {}) {
  let info: GraphQLResolveInfo | undefined;

  await execute({
    schema,
    document: parse(source),
    variableValues,
    contextValue: {},
    rootValue: {
      connection: (_args: unknown, _ctx: unknown, resolveInfo: GraphQLResolveInfo) => {
        info = resolveInfo;

        return null;
      },
    },
  });

  return info!;
}

async function selects(source: string, variableValues?: Record<string, unknown>) {
  return selectedFieldNames({}, await infoFor(source, variableValues)).has('totalCount');
}

describe('selectedFieldNames — directive + fragment walk', () => {
  it('returns true for a direct field match', async () => {
    expect(await selects('{ connection { totalCount } }')).toBe(true);
  });

  it('returns false when the field is absent', async () => {
    expect(await selects('{ connection { edges { cursor } } }')).toBe(false);
  });

  it('honors @skip(if: true) and @include(if: false) on the field', async () => {
    expect(await selects('{ connection { totalCount @skip(if: true) } }')).toBe(false);
    expect(await selects('{ connection { totalCount @include(if: false) } }')).toBe(false);
  });

  it('reads @skip / @include through variables', async () => {
    expect(
      await selects('query ($s: Boolean!) { connection { totalCount @skip(if: $s) } }', {
        s: true,
      }),
    ).toBe(false);
    expect(
      await selects('query ($s: Boolean!) { connection { totalCount @skip(if: $s) } }', {
        s: false,
      }),
    ).toBe(true);
  });

  it('descends into inline fragments', async () => {
    expect(await selects('{ connection { ... on PostConnection { totalCount } } }')).toBe(true);
  });

  it('descends into named fragments via info.fragments', async () => {
    expect(
      await selects(/* GraphQL */ `
        { connection { ...C } }
        fragment C on PostConnection { totalCount }
      `),
    ).toBe(true);
  });

  it('descends through nested named fragment spreads', async () => {
    expect(
      await selects(/* GraphQL */ `
        { connection { ...A } }
        fragment A on PostConnection { ...B }
        fragment B on PostConnection { totalCount }
      `),
    ).toBe(true);
  });

  it('does NOT honor @defer — deferred fields still count as selected', async () => {
    // Deferred fragments are still part of the GraphQL response stream; a deferred totalCount
    // must still be computed.
    expect(await selects('{ connection { ... @defer { totalCount } } }')).toBe(true);
  });

  it('honors @skip on a fragment spread', async () => {
    expect(
      await selects(/* GraphQL */ `
        { connection { ...C @skip(if: true) } }
        fragment C on PostConnection { totalCount }
      `),
    ).toBe(false);
  });

  it('does not match the field name beneath another field', async () => {
    expect(await selects('{ connection { nodes { id } } }')).toBe(false);
  });
});
