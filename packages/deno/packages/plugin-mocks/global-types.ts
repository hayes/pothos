// @ts-nocheck
import { ObjectParam, SchemaTypes, ShapeFromTypeParam } from '../core/index.ts';
import { Mock, ResolverMap } from './types.ts';
import { MocksPlugin } from './index.ts';
declare global {
    export namespace PothosSchemaTypes {
        export interface Plugins<Types extends SchemaTypes> {
            mocks: MocksPlugin<Types>;
        }
        export interface BuildSchemaOptions<Types extends SchemaTypes> {
            mocks?: ResolverMap<Types>;
            typeMocks?: Mock[];
        }
        export interface SchemaBuilder<Types extends SchemaTypes> {
            createMock: <Shape extends NameOrRef extends ObjectParam<Types> ? ShapeFromTypeParam<Types, NameOrRef, false> : object, NameOrRef extends ObjectParam<Types> | string>(nameOrRef: NameOrRef, resolver: () => Partial<Shape>) => Mock;
        }
    }
}
