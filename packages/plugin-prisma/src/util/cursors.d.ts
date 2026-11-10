import { type MaybePromise, type SchemaTypes } from '@pothos/core';
export declare function formatPrismaCursor(record: Record<string, unknown>, fields: string[] | string): string;
export declare function cursorFormatter(fields: string[] | string): (value: Record<string, unknown>) => string;
export declare function parsePrismaCursor(cursor: unknown): unknown;
export declare function parseID(id: string, dataType: string): unknown;
export declare function getDefaultIDSerializer<Types extends SchemaTypes>(modelName: string, fieldName: string, builder: PothosSchemaTypes.SchemaBuilder<Types>): (parent: Record<string, unknown>) => unknown;
export declare function getDefaultIDParser<Types extends SchemaTypes>(modelName: string, fieldName: string, builder: PothosSchemaTypes.SchemaBuilder<Types>): (id: string) => unknown;
export declare function serializeID(id: unknown, dataType: string): any;
export declare function parseCompositeCursor(fields: readonly string[]): (cursor: unknown) => Record<string, unknown>;
export interface PrismaCursorConnectionQueryOptions {
    args: PothosSchemaTypes.DefaultConnectionArguments;
    ctx: {};
    defaultSize?: number | ((args: {}, ctx: {}) => number);
    maxSize?: number | ((args: {}, ctx: {}) => number);
    parseCursor: (cursor: string) => Record<string, unknown>;
}
interface ResolvePrismaCursorConnectionOptions extends PrismaCursorConnectionQueryOptions {
    parent?: unknown;
    query: {};
    totalCount?: number | (() => MaybePromise<number>);
}
export declare function prismaCursorConnectionQuery({ args, ctx, maxSize, defaultSize, parseCursor, }: PrismaCursorConnectionQueryOptions): {
    take: number;
    skip: number;
    cursor?: undefined;
} | {
    cursor: Record<string, unknown>;
    take: number;
    skip: number;
};
export declare function wrapConnectionResult<T extends {}>(parent: unknown, results: readonly T[], args: PothosSchemaTypes.DefaultConnectionArguments, take: number, cursor: (node: T) => string, totalCount?: number | (() => MaybePromise<number>) | null, resolveNode?: (node: unknown) => unknown): {
    parent: unknown;
    args: PothosSchemaTypes.DefaultConnectionArguments;
    totalCount: number | (() => MaybePromise<number>) | null | undefined;
    edges: ({
        cursor: string;
        node: unknown;
    } | null)[];
    pageInfo: {
        startCursor: string | null;
        endCursor: string | null;
        hasPreviousPage: boolean;
        hasNextPage: boolean;
    };
};
export declare function resolvePrismaCursorConnection<T extends {}>(options: ResolvePrismaCursorConnectionOptions, cursor: (node: T) => string, resolve: (query: {
    include?: object;
    cursor?: object;
    take: number;
    skip: number;
}) => MaybePromise<readonly T[]>): Promise<{
    parent: unknown;
    args: PothosSchemaTypes.DefaultConnectionArguments;
    totalCount: number | (() => MaybePromise<number>) | null | undefined;
    edges: ({
        cursor: string;
        node: unknown;
    } | null)[];
    pageInfo: {
        startCursor: string | null;
        endCursor: string | null;
        hasPreviousPage: boolean;
        hasNextPage: boolean;
    };
}>;
export declare function getCursorFormatter<Types extends SchemaTypes>(name: string, builder: PothosSchemaTypes.SchemaBuilder<Types>, cursor: string): (value: Record<string, unknown>) => string;
export declare function getCursorParser<Types extends SchemaTypes>(name: string, builder: PothosSchemaTypes.SchemaBuilder<Types>, cursor: string): (rawCursor: string) => {
    [cursor]: unknown;
};
export {};
