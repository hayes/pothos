// @ts-nocheck
import type { SchemaTypes } from '../core/index.ts';
import type { ResolverMap } from './types.ts';
import type { PothosMocksPlugin } from './index.ts';
declare global {
    export namespace PothosSchemaTypes {
        export interface Plugins<Types extends SchemaTypes> {
            mocks: PothosMocksPlugin<Types>;
        }
        export interface BuildSchemaOptions<Types extends SchemaTypes> {
            mocks?: ResolverMap<Types>;
        }
    }
}
