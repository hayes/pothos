import type { SchemaTypes } from '@pothos/core';
import type { PothosMocksPlugin } from '.';
import type { ResolverMap } from './types';

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
