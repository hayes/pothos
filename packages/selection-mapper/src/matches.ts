import { createContextCache, PothosValidationError } from '@pothos/core';
import {
  doTypesOverlap,
  type FieldNode,
  type FragmentDefinitionNode,
  type FragmentSpreadNode,
  type GraphQLField,
  GraphQLIncludeDirective,
  type GraphQLNamedType,
  type GraphQLResolveInfo,
  type GraphQLSchema,
  GraphQLSkipDirective,
  getDirectiveValues,
  getNamedType,
  type InlineFragmentNode,
  isAbstractType,
  isInterfaceType,
  isObjectType,
  Kind,
} from 'graphql';

export interface IndirectPathSegment {
  type?: string;
  name: string;
}

export type PathSegment = string | IndirectPathSegment;

/**
 * Set on a type's extensions (by the errors plugin, or by hand) to say that a selection on the
 * type is really a selection on `getType()`, found under `path` (or any of `paths`).
 */
export interface IndirectInclude {
  getType: () => string;
  path?: IndirectPathSegment[];
  paths?: IndirectPathSegment[][];
}

export interface Match {
  /** The GraphQL type of the matched field's return type */
  type: GraphQLNamedType;
  field: FieldNode;
  /** Aliased field names from the starting selection to the matched field */
  path: string[];
  deferred: boolean;
}

export interface MatchOptions {
  /** A type-level path prepended to every path. */
  prefix?: IndirectPathSegment[];
  /** The alias path the returned matches' paths start with. */
  path?: string[];
  deferred?: boolean;
}

/** Just enough of an `Adapter` to look a type's model up. */
export interface ModelLookup<Model> {
  modelFor: (type: GraphQLNamedType) => Model | undefined;
}

/** The include a type carries, if any. */
export function includeOf(type: GraphQLNamedType): IndirectInclude | undefined {
  return type.extensions?.pothosIndirectInclude as IndirectInclude | undefined;
}

/** Follows `pothosIndirectInclude.getType()` until a type without one. */
export function resolveType(schema: GraphQLSchema, type: GraphQLNamedType): GraphQLNamedType {
  let target = type;
  let include = includeOf(target);

  while (include) {
    target = schema.getType(include.getType())!;
    include = includeOf(target);
  }

  return target;
}

/**
 * The model of a type, following indirect includes, which `Adapter.modelFor` does not. Every
 * model question the plan asks goes through here.
 */
export function modelOf<Model>(
  adapter: ModelLookup<Model>,
  schema: GraphQLSchema,
  type: GraphQLNamedType,
): Model | undefined {
  return adapter.modelFor(resolveType(schema, type));
}

/**
 * W-10: `matches` without the ones whose field returns a model other than `targetType`'s. Several
 * implementations of an interface may share a field name while returning different models, and
 * their selections must never be merged into the same query. Types without a model always match,
 * and a target without one filters nothing.
 */
export function matchesForModel<Model>(
  adapter: ModelLookup<Model>,
  schema: GraphQLSchema,
  matches: Match[],
  targetType: GraphQLNamedType,
): Match[] {
  const targetModel = modelOf(adapter, schema, targetType);

  if (!targetModel) {
    return matches;
  }

  return matches.filter((match) => {
    const model = modelOf(adapter, schema, match.type);

    return !model || model === targetModel;
  });
}

/**
 * One selection set being read, as `eachSelectedField` hands it to a visitor.
 *
 * `type` is the type of the selection set. `expectedType` is the type a field must be selected on
 * for it to count: a field applies only while the two are the same, which is what stops a
 * same-named field under an unrelated fragment from being seen. `resolveFragmentTypes` moves both.
 */
export interface SelectionLevel {
  type: GraphQLNamedType;
  expectedType: GraphQLNamedType;
  /** Aliased field names from the starting selection down to this level. */
  path: string[];
  /** S-8: a `@defer` was crossed on the way to this level. */
  deferred: boolean;
}

/**
 * What `eachSelectedField` calls at every field that applies. Returning `true` stops the
 * traversal; anything else continues it.
 */
export type FieldVisitor = (field: FieldNode, level: SelectionLevel) => boolean | void;

/**
 * The one selection traversal this package owns. It reads the selections of `selection` at
 * `level`: drops what a directive removes (S-2), classifies every fragment
 * (`resolveFragmentTypes`), notes whether a `@defer` was crossed (S-8), descends into the
 * fragments that apply, expands a named fragment once per state (`memo`), and calls `visit` at
 * every field that applies to `level.type`. What happens at a field is the caller's alone, which
 * is the whole of the difference between its consumers: `matchPath` matches one path segment's
 * name and descends with the rest of the path, `collectSelectedFieldNames` adds every name and
 * descends no further, and `firstMatch` takes the first match and stops.
 *
 * `segment` is the indirect-include path segment the caller is looking for, when it has one; only
 * its `type` is read, to pin the type a fragment is expected on.
 *
 * `memo` records the named fragments already expanded, keyed on the fragment, the two types, the
 * deferred flag, and `memoKey` — whatever else the caller varies as it descends (`matchPath`
 * passes its remaining path length and its alias path). A fragment spread more than once at one
 * point of the traversal is expanded once: walking it again could only repeat the same work, and
 * a valid fragment DAG can spread the same fragment at every level, which makes expanding every
 * spread exponential in its depth. A caller that varies nothing passes no `memoKey`, and its memo
 * is then finer than it needs to be by the deferred flag alone — at most twice as fine, which
 * costs a little time and never correctness for a caller that accumulates.
 *
 * S-8, the defer asymmetry, which lives here because this is the only place the flag is computed:
 * this traversal decides nothing about `@defer`. It reports `level.deferred` and the visitor
 * chooses, and the consumers do not choose alike.
 *
 * - `findMatches` reports the flag, and `walkBranches` honours it: a deferred branch is entered
 *   but, when `skipDeferredFragments` is set, its fields are not walked.
 * - `firstMatch` (E-5, the `selectedFieldNode` a select function is handed) discards it.
 * - `selectedFieldNames` discards it.
 *
 * So the last two over-report: they answer "yes, the document selects this" for a selection that
 * the branch resolution will skip. That direction is what makes the divergence safe. The plugins
 * use both as gates — does the document ask for `totalCount`, is this column selected — and a
 * gate computed from an over-reporting source can only be wrongly true, which loads a column or a
 * count nothing reads. It can never be wrongly false, so no row goes missing, and anything
 * genuinely under-fetched elsewhere falls through to the model loader, which re-queries. Make
 * either of them honour the flag and the gates start under-reporting instead, which loses data;
 * `matches.test.ts` pins the direction.
 */
function eachSelectedField(
  info: GraphQLResolveInfo,
  selection: FieldNode | FragmentDefinitionNode | InlineFragmentNode,
  level: SelectionLevel,
  segment: IndirectPathSegment | undefined,
  visit: FieldVisitor,
  memo: Set<string>,
  memoKey = '',
): boolean {
  if (!selection.selectionSet) {
    return false;
  }

  const { type, path, deferred } = level;
  // A segment that pins a type condition pins it here too: its field must be found under a
  // fragment on that type, never taken from a level that merely has a field of the same name.
  const expectedType = pinnedType(info, segment) ?? level.expectedType;
  const fieldsApply =
    expectedType.name === type.name && (isObjectType(type) || isInterfaceType(type));

  for (const sel of selection.selectionSet.selections) {
    if (isSkipped(info, sel)) {
      continue;
    }

    let fragment: FragmentDefinitionNode | InlineFragmentNode;

    switch (sel.kind) {
      case Kind.FIELD: {
        if (fieldsApply && visit(sel, level) === true) {
          return true;
        }

        continue;
      }
      case Kind.FRAGMENT_SPREAD:
        fragment = info.fragments[sel.name.value];
        break;
      case Kind.INLINE_FRAGMENT:
        fragment = sel;
        break;
      default: {
        const unsupported: never = sel;

        throw new PothosValidationError(
          `Unsupported selection kind ${(unsupported as { kind: string }).kind}`,
        );
      }
    }

    const next = resolveFragmentTypes(
      info,
      fragment.typeCondition ? info.schema.getType(fragment.typeCondition.name.value)! : undefined,
      type,
      expectedType,
    );
    const deferredHere = deferred || isDeferred(info, sel);

    if (fragment.kind === Kind.FRAGMENT_DEFINITION) {
      const state = `${fragment.name.value}|${next.type.name}|${next.expectedType.name}|${deferredHere}|${memoKey}`;

      if (memo.has(state)) {
        continue;
      }

      memo.add(state);
    }

    const stopped = eachSelectedField(
      info,
      fragment,
      { type: next.type, expectedType: next.expectedType, path, deferred: deferredHere },
      segment,
      visit,
      memo,
      memoKey,
    );

    if (stopped) {
      return true;
    }
  }

  return false;
}

/**
 * The field `name` of `type`, or a validation error. A document naming a field the type does not
 * have only reaches here when graphql validation was skipped; without this it would read a
 * property of undefined.
 */
function fieldOn(type: GraphQLNamedType, name: string): GraphQLField<unknown, unknown> {
  const field = isObjectType(type) || isInterfaceType(type) ? type.getFields()[name] : undefined;

  if (!field) {
    throw new PothosValidationError(`Unknown field ${name} on ${type.name}`);
  }

  return field;
}

/**
 * Follows `includePath` from `level`, starting at segment `at`, to the fields selected at its end,
 * reporting each to `onMatch` in document order and stopping when `onMatch` says to. Every step is
 * one `eachSelectedField` whose visitor matches that segment by name and follows the rest of the
 * path beneath it; the end of the path is the match itself. The path is walked by index so that a
 * step allocates nothing but the alias path it grew.
 */
function matchPath(
  info: GraphQLResolveInfo,
  selection: FieldNode | FragmentDefinitionNode | InlineFragmentNode,
  level: SelectionLevel,
  includePath: IndirectPathSegment[],
  at: number,
  onMatch: (match: Match) => boolean | void,
  memo: Set<string>,
): boolean {
  const remaining = includePath.length - at;

  if (remaining === 0) {
    return (
      onMatch({
        type: level.type,
        field: selection as FieldNode,
        path: level.path,
        deferred: level.deferred,
      }) === true
    );
  }

  const segment = includePath[at];

  return eachSelectedField(
    info,
    selection,
    level,
    segment,
    (field, on) => {
      if (field.name.value !== segment.name) {
        return false;
      }

      const returnType = getNamedType(fieldOn(on.type, field.name.value).type);

      return matchPath(
        info,
        field,
        {
          type: returnType,
          expectedType: returnType,
          path: [...on.path, field.alias?.value ?? field.name.value],
          deferred: on.deferred,
        },
        includePath,
        at + 1,
        onMatch,
        memo,
      );
    },
    memo,
    `${remaining}|${level.path.join('.')}`,
  );
}

/**
 * Follows each of `paths`, prefixed by any type-level `prefix`, from `selection` (which is expected
 * to be a selection on `type`), reporting the fields at their ends to `onMatch` in path order then
 * document order, and stopping when `onMatch` says to. Paths are followed through fragments; see
 * `resolveFragmentTypes` for the rules. Each path gets its own memo: what one path expanded says
 * nothing about the next.
 */
function eachMatch(
  info: GraphQLResolveInfo,
  type: GraphQLNamedType,
  selection: FieldNode | FragmentDefinitionNode | InlineFragmentNode,
  paths: IndirectPathSegment[][],
  { prefix, path = [], deferred = false }: MatchOptions,
  onMatch: (match: Match) => boolean | void,
): void {
  for (const includePath of paths) {
    const stopped = matchPath(
      info,
      selection,
      { type, expectedType: type, path, deferred },
      prefix?.length ? [...prefix, ...includePath] : includePath,
      0,
      onMatch,
      new Set(),
    );

    if (stopped) {
      return;
    }
  }
}

/**
 * Every field selected at the end of one of `paths`, each with the `deferred` flag
 * `eachSelectedField` computed for it.
 */
export function findMatches(
  info: GraphQLResolveInfo,
  type: GraphQLNamedType,
  selection: FieldNode | FragmentDefinitionNode | InlineFragmentNode,
  paths: IndirectPathSegment[][],
  options: MatchOptions = {},
): Match[] {
  const matches: Match[] = [];

  eachMatch(info, type, selection, paths, options, (match) => {
    matches.push(match);
  });

  return matches;
}

/**
 * E-5: the first field selected at the end of `path`, in document order, or undefined. The
 * traversal stops at it. The match's `deferred` flag is reported but this function's caller — the
 * `selectedFieldNode` handed to a select function — discards it; see `eachSelectedField` for why
 * over-reporting a deferred selection there is safe.
 */
export function firstMatch(
  info: GraphQLResolveInfo,
  type: GraphQLNamedType,
  selection: FieldNode,
  path: IndirectPathSegment[],
  { prefix }: Pick<MatchOptions, 'prefix'> = {},
): Match | undefined {
  let first: Match | undefined;

  eachMatch(info, type, selection, [path], { prefix }, (match) => {
    first = match;

    return true;
  });

  return first;
}

/** One node of the memo trie: the names for the field nodes on the path to it, if computed. */
interface SelectedFieldNamesEntry {
  names?: ReadonlySet<string>;
  next: WeakMap<FieldNode, SelectedFieldNamesEntry>;
}

/**
 * Per request context, per execution (`info.variableValues` is built once per execution, and the
 * names depend on the variables through `@skip`/`@include`), per return type, then per field node.
 */
const selectedFieldNamesCache = createContextCache(
  () => new WeakMap<object, WeakMap<GraphQLNamedType, SelectedFieldNamesEntry>>(),
);

/**
 * The names of the fields the document selects directly beneath the field being resolved, seen
 * through any wrapper on its return type: `selectsPath(info, [name])` for every top-level name in
 * one traversal. Every row of a list resolves the field with the same field nodes, so the result
 * is memoised on them for the execution, which is what a resolver called per row wants. The memo
 * is keyed on the nodes rather than on `info.fieldNodes`: graphql-js 17 builds that array anew
 * for every resolve, while the nodes are the document's own. Beneath that it is keyed on
 * `info.variableValues` (one object per execution) and on the return type.
 *
 * S-8: `@skip` and `@include` are honoured, `@defer` is not — a name selected only under a
 * deferred fragment is reported as selected, even when the plan that loads the row is set to skip
 * deferred fragments and will not walk it. `findMatches`, and so the plan's own branch
 * resolution, does honour it, so the two disagree; `eachSelectedField` states which consumers see
 * a deferred selection and why this set, being the over-reporting side, is the safe one for a
 * plugin to gate a column or a count on. A caller that needs to know what the plan will actually
 * load must ask the plan, not this.
 */
export function selectedFieldNames(context: object, info: GraphQLResolveInfo): ReadonlySet<string> {
  const byExecution = selectedFieldNamesCache(context);
  let byType = byExecution.get(info.variableValues);

  if (!byType) {
    byType = new WeakMap();
    byExecution.set(info.variableValues, byType);
  }

  let entry = entryIn(byType, getNamedType(info.returnType));

  for (const node of info.fieldNodes) {
    entry = entryIn(entry.next, node);
  }

  entry.names ??= collectSelectedFieldNames(info);

  return entry.names;
}

function entryIn<K extends object>(
  map: WeakMap<K, SelectedFieldNamesEntry>,
  key: K,
): SelectedFieldNamesEntry {
  let entry = map.get(key);

  if (!entry) {
    entry = { next: new WeakMap() };
    map.set(key, entry);
  }

  return entry;
}

function collectSelectedFieldNames(info: GraphQLResolveInfo): ReadonlySet<string> {
  const returnType = getNamedType(info.returnType);
  const prefix = includeOf(returnType)?.path;
  const names = new Set<string>();
  // Every name at one level: `eachSelectedField`'s last step for all of them at once. The level's
  // `deferred` flag is never read, which is the asymmetry `eachSelectedField` documents.
  const addName: FieldVisitor = (field) => {
    names.add(field.name.value);
  };

  for (const node of info.fieldNodes) {
    // Through a wrapper, the fields are those beneath its inner field.
    const roots: { type: GraphQLNamedType; field: FieldNode; deferred: boolean }[] = prefix?.length
      ? findMatches(info, returnType, node, [prefix])
      : [{ type: returnType, field: node, deferred: false }];

    for (const root of roots) {
      eachSelectedField(
        info,
        root.field,
        { type: root.type, expectedType: root.type, path: [], deferred: root.deferred },
        undefined,
        addName,
        new Set(),
      );
    }
  }

  return names;
}

/**
 * Determines the type to walk and the type the next segment is expected on when descending into a
 * fragment.
 *
 * `expected` arrives pinned: `eachSelectedField` resolved any `type` on the segment before it
 * classified a single selection, so nothing here has to ask again.
 *
 * - A fragment on the expected type, or on an abstract type the expected type belongs to, walks as
 *   the expected type: every field selectable there also exists on it.
 * - A fragment that narrows an abstract expected type to an implementation or member, or to an
 *   abstract type that overlaps it, advances the expected type so the segment's field can be found
 *   on the narrower type.
 * - Fragments on unrelated types keep the expected type, so their fields are skipped until a nested
 *   fragment narrows back to it.
 */
function resolveFragmentTypes(
  info: GraphQLResolveInfo,
  fragmentType: GraphQLNamedType | undefined,
  type: GraphQLNamedType,
  expected: GraphQLNamedType,
) {
  if (!fragmentType || fragmentType.name === expected.name) {
    return { type: fragmentType ?? type, expectedType: expected };
  }

  if (
    isAbstractType(fragmentType) &&
    (isObjectType(expected) || isInterfaceType(expected)) &&
    info.schema.isSubType(fragmentType, expected)
  ) {
    return { type: expected, expectedType: expected };
  }

  if (isAbstractType(expected)) {
    const narrows =
      isObjectType(fragmentType) || isInterfaceType(fragmentType)
        ? info.schema.isSubType(expected, fragmentType)
        : false;
    const overlaps =
      isAbstractType(fragmentType) && doTypesOverlap(info.schema, expected, fragmentType);

    if (narrows || overlaps) {
      return { type: fragmentType, expectedType: fragmentType };
    }
  }

  return { type: fragmentType, expectedType: expected };
}

/**
 * The type an indirect-include segment pins its field to, or undefined when it pins none. A
 * pinned segment names the fragment type condition the field must be found under, so the pin
 * decides both which fragments are descended into and whether a field selected directly at a
 * level counts as the segment's.
 */
function pinnedType(info: GraphQLResolveInfo, segment: IndirectPathSegment | undefined) {
  if (!segment?.type) {
    return undefined;
  }

  const pinned = info.schema.getType(segment.type);

  if (!pinned) {
    throw new PothosValidationError(
      `Unknown type ${segment.type} in indirect include path segment ${segment.name}`,
    );
  }

  return pinned;
}

/**
 * Turns a path handed to `nestedSelection` into an include. A string segment is a field of the
 * type the previous segment reached; the walker narrows through fragments on its own. A
 * `{ name, type }` segment pins the fragment type condition the field must be found under, and
 * is a field of that type.
 */
export function normalizeInclude(
  path: PathSegment[],
  type: GraphQLNamedType,
  expectedType: GraphQLNamedType | undefined,
  schema: GraphQLSchema,
): IndirectInclude {
  let currentType = path.length > 0 ? type : (expectedType ?? type);

  const normalized: IndirectPathSegment[] = [];

  if (path.length === 0 && !(isObjectType(currentType) || isInterfaceType(currentType))) {
    throw new PothosValidationError(`Expected ${currentType} to be an Object type`);
  }

  for (const segment of path) {
    const { name, type: pinned } = typeof segment === 'string' ? { name: segment } : segment;

    if (pinned) {
      const pinnedType = schema.getType(pinned);

      if (!pinnedType) {
        throw new PothosValidationError(
          `Unknown type ${pinned} in nested selection path segment ${name}`,
        );
      }

      currentType = pinnedType;
    }

    if (!(isObjectType(currentType) || isInterfaceType(currentType))) {
      throw new PothosValidationError(`Expected ${currentType} to be an Object type`);
    }

    const field: GraphQLField<unknown, unknown> = currentType.getFields()[name];

    if (!field) {
      throw new PothosValidationError(`Expected ${currentType} to have a field ${name}`);
    }

    currentType = getNamedType(field.type);

    if (!(isObjectType(currentType) || isInterfaceType(currentType))) {
      throw new PothosValidationError(`Expected ${currentType} to be an Object or Interface type`);
    }

    normalized.push(pinned ? { name, type: pinned } : { name });
  }

  const targetType = currentType;

  return {
    getType: () => expectedType?.name ?? targetType.name,
    path: normalized,
  };
}

/**
 * S-2: a field or fragment under `@skip(if: true)` or `@include(if: false)`. Asked of every
 * selection the traversal reads, so it answers a selection carrying no directive at all — nearly
 * every one — without building a directive's argument values twice.
 */
export function isSkipped(
  info: GraphQLResolveInfo,
  selection: FieldNode | FragmentSpreadNode | InlineFragmentNode,
) {
  if (!selection.directives?.length) {
    return false;
  }

  const skip = getDirectiveValues(GraphQLSkipDirective, selection, info.variableValues);
  if (skip?.if === true) {
    return true;
  }

  const include = getDirectiveValues(GraphQLIncludeDirective, selection, info.variableValues);
  if (include?.if === false) {
    return true;
  }

  return false;
}

/** S-8: a fragment under `@defer` (when the schema declares the directive). */
export function isDeferred(
  info: GraphQLResolveInfo,
  node: FragmentSpreadNode | InlineFragmentNode,
) {
  if (!node.directives?.length) {
    return false;
  }

  const deferDirective = info.schema.getDirective('defer');
  if (!deferDirective) {
    return false;
  }

  const defer = getDirectiveValues(deferDirective, node, info.variableValues);
  return !!defer && defer.if !== false;
}
