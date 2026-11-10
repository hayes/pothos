/**
 * Tracks whether a resolver read anything off the query it was handed, so a plugin can warn about
 * a `query` that was never spread into the ORM call.
 */
export declare const usageSymbol: unique symbol;
export declare function wrapWithUsageCheck<T extends object>(obj: T): T;
export declare function isUsed(obj: object): boolean;
export declare function extendWithUsage<T extends object, U extends object>(original: T, extension: U): T & U;
