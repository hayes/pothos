import { type InputFieldMap, type InputShapeFromFields, type MaybeAsyncSelection, type MaybePromise, type SchemaTypes } from '@pothos/core';
import type { PathSegment } from '@pothos/selection-mapper';
import type { PrismaRef } from './interface-ref.js';
import type { PrismaModelTypes, SelectionMap, ShapeFromSelection, UniqueFieldsFromWhereUnique } from './types.js';
export declare function prismaConnectionHelpers<Types extends SchemaTypes, RefOrType extends PrismaRef<Types, PrismaModelTypes> | keyof Types['PrismaTypes'], Select extends Model['Select'] & {}, Model extends PrismaModelTypes = RefOrType extends PrismaRef<Types, infer T> ? PrismaModelTypes & T : PrismaModelTypes & Types['PrismaTypes'][RefOrType & keyof Types['PrismaTypes']], Shape = RefOrType extends PrismaRef<Types, PrismaModelTypes, infer T> ? T : Model['Shape'], EdgeShape = Model['Include'] extends Select ? Shape : ShapeFromSelection<Types, Model, {
    select: Select;
}>, NodeShape = EdgeShape, ExtraArgs extends InputFieldMap = {}>(builder: PothosSchemaTypes.SchemaBuilder<Types>, refOrType: RefOrType, { cursor, select, resolveNode, query, args: createArgs, maxSize, defaultSize, }: {
    cursor: UniqueFieldsFromWhereUnique<Model['WhereUnique']>;
    select?: (nestedSelection: <T extends true | {}>(selection?: T) => T, args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments, ctx: Types['Context']) => MaybeAsyncSelection<Types, Select>;
    query?: ((args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments, ctx: Types['Context']) => MaybeAsyncSelection<Types, {
        where?: Model['Where'];
        orderBy?: Model['OrderBy'];
    }>) | {
        where?: Model['Where'];
        orderBy?: Model['OrderBy'];
    };
    defaultSize?: number | ((args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments, ctx: Types['Context']) => number);
    maxSize?: number | ((args: PothosSchemaTypes.DefaultConnectionArguments, ctx: Types['Context']) => number);
    resolveNode?: (edge: EdgeShape) => NodeShape;
    args?: (t: PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>) => ExtraArgs;
}): {
    ref: PrismaRef<Types, Model, Model['Shape']>;
    resolve: <Parent = unknown>(list: (EdgeShape & {})[], args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments, ctx: Types['Context'], parent?: Parent) => {
        edges: (Omit<EdgeShape, 'cursor' | 'node'> & {
            node: NodeShape;
            cursor: string;
        })[];
        pageInfo: {
            startCursor: string | null;
            endCursor: string | null;
            hasPreviousPage: boolean;
            hasNextPage: boolean;
        };
    };
    select: {};
    getQuery: <Await extends boolean = false>(args: InputShapeFromFields<ExtraArgs> & PothosSchemaTypes.DefaultConnectionArguments, ctx: Types['Context'], nestedSelection: (selection?: SelectionMap | true, path?: PathSegment[]) => unknown, options?: {
        /** Whether the caller will await the query. */
        awaitSelections?: Await;
    }) => [Await] extends [false] ? (Model["Select"] extends Select ? {} : {
        select: Select;
    }) & {
        where?: Model['Where'];
        orderBy?: Model['OrderBy'];
        skip?: number;
        take?: number;
        cursor?: Model['WhereUnique'];
    } : MaybePromise<(Model["Select"] extends Select ? {} : {
        select: Select;
    }) & {
        where?: Model['Where'];
        orderBy?: Model['OrderBy'];
        skip?: number;
        take?: number;
        cursor?: Model['WhereUnique'];
    }>;
    getArgs: () => ExtraArgs;
};
