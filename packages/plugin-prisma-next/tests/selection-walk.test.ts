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
    variableValues: overrides.variableValues ?? {},
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
  it('breaks a fragment cycle (A → B → A) without recursing forever', () => {
    // Defense-in-depth: GraphQL.js's `NoFragmentCyclesRule` rejects
    // cycles at validation time, but a host running execute() without
    // validate() (persisted queries / custom executors) could let one
    // through. The visited-set keeps the walk finite.
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
            selections: [{ kind: 'FragmentSpread', name: { kind: 'Name', value: 'A' } }],
          },
        },
      },
      variableValues: {},
    } as never;
    // Walk completes without a stack overflow; the cyclic fragments
    // don't contain `totalCount`, so the answer is `false`.
    expect(selectionIncludesField(info, 'totalCount')).toBe(false);
  });

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
