// @ts-nocheck
import { SchemaTypes } from '../core/index.ts';
import { ResolverMap } from './types.ts';
import { MocksPlugin } from './index.ts';
declare global {
    export namespace GiraphQLSchemaTypes {
        export interface Plugins<Types extends SchemaTypes> {
            mocks: MocksPlugin<Types>;
        }
        export interface BuildSchemaOptions<Types extends SchemaTypes> {
            mocks?: ResolverMap<Types>;
        }
    }
}
