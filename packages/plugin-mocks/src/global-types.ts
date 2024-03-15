import { SchemaTypes } from '@pothos/core';
import { ResolverMap } from './types';

import type { PothosMocksPlugin } from '.';

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
