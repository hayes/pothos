import { type Node, NodeAdapter, type Plan, type PlayedPlan, type QueryVisitor, type SelectFn } from '@pothos/selection-mapper';
import type { GraphQLField, GraphQLNamedType } from 'graphql';
import type { SelectionMap } from '../types.js';
import type { FieldMap } from './relation-map.js';
export type PrismaNode = Node<FieldMap>;
export type PrismaPlan = Plan<FieldMap, SelectionMap>;
export type PrismaPlayedPlan = PlayedPlan<FieldMap, SelectionMap>;
type PrismaVisitor = QueryVisitor<FieldMap, SelectionMap>;
/** A map without `select`: include mode, every column. Shared and never mutated. */
export declare const INCLUDE_ALL: SelectionMap;
/**
 * How prisma selections (`{ select, include, ...args }`) read onto the shared query tree, and how
 * a node is written back. A node in named-column mode serializes to `select`; a node whose
 * columns are `null` (include mode, the default for a type without a type-level `select`)
 * serializes to `include`. `_count` keys are the node's computed values, keyed by relation name.
 *
 * The merge, compare and conflict rules are `NodeAdapter`'s: this is the schema side, the key
 * loop and `toQuery`.
 */
declare class PrismaAdapter extends NodeAdapter<FieldMap, SelectionMap> {
    modelFor(type: GraphQLNamedType): FieldMap | undefined;
    typeSelection(type: GraphQLNamedType): SelectionMap | undefined;
    fieldSelection(field: GraphQLField<unknown, unknown>): SelectFn<SelectionMap> | {
        select: Record<string, boolean | SelectionMap>;
    } | undefined;
    visitQuery({ select, include, ...args }: SelectionMap, model: FieldMap, visit: PrismaVisitor): void;
    /**
     * A named count already on the node must be equal, and `_count: true` only agrees with
     * unfiltered counts.
     */
    computedConflicts(computed: ReadonlyMap<string, unknown>, name: string, value: unknown): boolean;
    toQuery(node: PrismaNode): SelectionMap;
}
export declare const prismaAdapter: PrismaAdapter;
export {};
