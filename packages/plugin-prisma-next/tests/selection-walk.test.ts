import { describe, expect, it } from 'vitest';
import { selectionIncludesField } from '../src/utils/selection-walk';

function mkInfo(
  selections: object[],
  overrides: {
    fragments?: Record<string, object>;
    variableValues?: Record<string, unknown>;
  } = {},
) {
  return {
    fieldNodes: [
      {
        kind: 'Field',
        name: { kind: 'Name', value: 'x' },
        selectionSet: { kind: 'SelectionSet', selections },
      },
    ],
    fragments: overrides.fragments ?? {},
    // graphql 17 changed `info.variableValues` from a plain `{ name: value }`
    // map to a structured `{ sources, coerced }` object (`getDirectiveValues`
    // reads `.coerced`). The plugin passes `info.variableValues` through
    // unchanged, so the mock must match the installed graphql's shape.
    variableValues: { sources: {}, coerced: overrides.variableValues ?? {} },
  } as never;
}

describe('selectionIncludesField — directive + fragment walk', () => {
  it('returns true for a direct field match', () => {
    const info = mkInfo([{ kind: 'Field', name: { kind: 'Name', value: 'totalCount' } }]);
    expect(selectionIncludesField(info, 'totalCount')).toBe(true);
  });

  it('returns false when the field is absent', () => {
    const info = mkInfo([{ kind: 'Field', name: { kind: 'Name', value: 'edges' } }]);
    expect(selectionIncludesField(info, 'totalCount')).toBe(false);
  });

  it('honors @skip(if: true) on the field', () => {
    const info = mkInfo([
      {
        kind: 'Field',
        name: { kind: 'Name', value: 'totalCount' },
        directives: [
          {
            kind: 'Directive',
            name: { kind: 'Name', value: 'skip' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'if' },
                value: { kind: 'BooleanValue', value: true },
              },
            ],
          },
        ],
      },
    ]);
    expect(selectionIncludesField(info, 'totalCount')).toBe(false);
  });

  it('honors @include(if: false) on the field', () => {
    const info = mkInfo([
      {
        kind: 'Field',
        name: { kind: 'Name', value: 'totalCount' },
        directives: [
          {
            kind: 'Directive',
            name: { kind: 'Name', value: 'include' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'if' },
                value: { kind: 'BooleanValue', value: false },
              },
            ],
          },
        ],
      },
    ]);
    expect(selectionIncludesField(info, 'totalCount')).toBe(false);
  });

  it('honors @skip via a variable', () => {
    const info = mkInfo(
      [
        {
          kind: 'Field',
          name: { kind: 'Name', value: 'totalCount' },
          directives: [
            {
              kind: 'Directive',
              name: { kind: 'Name', value: 'skip' },
              arguments: [
                {
                  kind: 'Argument',
                  name: { kind: 'Name', value: 'if' },
                  value: { kind: 'Variable', name: { kind: 'Name', value: 'doSkip' } },
                },
              ],
            },
          ],
        },
      ],
      { variableValues: { doSkip: true } },
    );
    expect(selectionIncludesField(info, 'totalCount')).toBe(false);
  });

  it('descends into inline fragments', () => {
    const info = mkInfo([
      {
        kind: 'InlineFragment',
        selectionSet: {
          kind: 'SelectionSet',
          selections: [{ kind: 'Field', name: { kind: 'Name', value: 'totalCount' } }],
        },
      },
    ]);
    expect(selectionIncludesField(info, 'totalCount')).toBe(true);
  });

  it('descends into named fragments via info.fragments', () => {
    const info = mkInfo(
      [
        {
          kind: 'FragmentSpread',
          name: { kind: 'Name', value: 'PageInfo' },
        },
      ],
      {
        fragments: {
          PageInfo: {
            kind: 'FragmentDefinition',
            name: { kind: 'Name', value: 'PageInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'totalCount' } }],
            },
          },
        },
      },
    );
    expect(selectionIncludesField(info, 'totalCount')).toBe(true);
  });

  it('does NOT honor @defer — deferred fields still count as selected', () => {
    // Deferred fragments are still part of the GraphQL response stream
    // (just delivered later). The gate fires the optional work either
    // way — the resolver builds `parent.totalCount` and the deferred
    // delivery surfaces it normally.
    const info = mkInfo([
      {
        kind: 'InlineFragment',
        directives: [
          {
            kind: 'Directive',
            name: { kind: 'Name', value: 'defer' },
          },
        ],
        selectionSet: {
          kind: 'SelectionSet',
          selections: [{ kind: 'Field', name: { kind: 'Name', value: 'totalCount' } }],
        },
      },
    ]);
    expect(selectionIncludesField(info, 'totalCount')).toBe(true);
  });
});

describe('selectionSetIncludesField — fragment recursion', () => {
  // Fragment cycle handling intentionally delegated to GraphQL.js's
  // NoFragmentCycles validation rule.

  it('descends through nested named fragment spreads', () => {
    const info = {
      fieldNodes: [
        {
          kind: 'Field',
          name: { kind: 'Name', value: 'x' },
          selectionSet: {
            kind: 'SelectionSet',
            selections: [{ kind: 'FragmentSpread', name: { kind: 'Name', value: 'A' } }],
          },
        },
      ],
      fragments: {
        A: {
          kind: 'FragmentDefinition',
          name: { kind: 'Name', value: 'A' },
          selectionSet: {
            kind: 'SelectionSet',
            selections: [{ kind: 'FragmentSpread', name: { kind: 'Name', value: 'B' } }],
          },
        },
        B: {
          kind: 'FragmentDefinition',
          name: { kind: 'Name', value: 'B' },
          selectionSet: {
            kind: 'SelectionSet',
            selections: [{ kind: 'Field', name: { kind: 'Name', value: 'totalCount' } }],
          },
        },
      },
      variableValues: {},
    } as never;
    expect(selectionIncludesField(info, 'totalCount')).toBe(true);
  });
});
