// @ts-nocheck
import { SchemaTypes } from '../core/index.ts';
import { ResolverMap } from './types.ts';
import { MocksPlugin } from './index.ts';
declare global {
    export namespace PothosSchemaTypes {
        export interface Plugins<Types extends SchemaTypes> {
            mocks: MocksPlugin<Types>;
        }
        export interface BuildSchemaOptions<Types extends SchemaTypes> {
            mocks?: ResolverMap<Types>;
        }
    }
}
